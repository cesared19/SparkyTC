package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.attachments.AttachmentContentDTO
import com.sparkytc.sparkytcservice.dto.attachments.TestCaseAttachmentDTO
import com.sparkytc.sparkytcservice.dto.dashboard.*
import com.sparkytc.sparkytcservice.dto.documents.*
import com.sparkytc.sparkytcservice.dto.auth.UserRole
import com.sparkytc.sparkytcservice.dto.auth.UserSummaryDTO
import com.sparkytc.sparkytcservice.dto.jira.JiraIssueDTO
import com.sparkytc.sparkytcservice.dto.jira.SimilarJiraIssueDTO
import com.sparkytc.sparkytcservice.dto.projects.JiraFailureMode
import com.sparkytc.sparkytcservice.dto.projects.UpdateProjectSettingsDTO
import com.sparkytc.sparkytcservice.dto.jira.CreateJiraIssueDTO
import com.sparkytc.sparkytcservice.dto.jira.JiraLinkDTO
import com.sparkytc.sparkytcservice.dto.jira.LinkJiraIssueDTO
import com.sparkytc.sparkytcservice.dto.projects.CreateWorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.projects.WorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.properties.*
import com.sparkytc.sparkytcservice.dto.testcases.BatchCreateTestCasesDTO
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.testcases.TestCaseDTO
import com.sparkytc.sparkytcservice.dto.testruns.*
import com.sparkytc.sparkytcservice.models.*
import com.sparkytc.sparkytcservice.repositories.*
import com.sparkytc.sparkytcservice.utility.Tools
import jakarta.transaction.Transactional
import org.apache.commons.logging.Log
import org.apache.commons.logging.LogFactory
import org.apache.poi.wp.usermodel.HeaderFooterType
import org.apache.poi.xwpf.usermodel.ParagraphAlignment
import org.apache.poi.xwpf.usermodel.UnderlinePatterns
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STFldCharType
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import java.io.ByteArrayOutputStream
import java.util.*

@Service
class WorkspaceService(
    private val projectRepository: WorkspaceProjectRepository,
    private val testCaseRepository: TestCaseRepository,
    private val propertyConfigurationRepository: PropertyConfigurationRepository,
    private val testCasePropertyValueRepository: TestCasePropertyValueRepository,
    private val testRunRepository: TestRunRepository,
    private val testCaseRunRepository: TestCaseRunRepository,
    private val testCaseAttachmentRepository: TestCaseAttachmentRepository,
    private val testCaseAttachmentContentRepository: TestCaseAttachmentContentRepository,
    private val testCaseJiraLinkRepository: TestCaseJiraLinkRepository,
    private val jiraService: JiraService,
    private val projectAccessService: ProjectAccessService,
    private val notificationService: NotificationService,
    private val userRepository: UserRepository,
    private val projectBuildService: ProjectBuildService,
) {
    private val log: Log = LogFactory.getLog(javaClass)

    fun retrieveProjects(): List<WorkspaceProjectDTO> {
        val projects = projectRepository.findAllByOrderByTitleAsc()
        return projectAccessService.accessibleProjects(CurrentUser.get(), projects).map { it.toDTO() }
    }

    fun createProject(project: CreateWorkspaceProjectDTO) {
        require(project.title.isNotBlank()) { "Project must have a title" }
        require(project.projectShortCode.isNotBlank()) { "Project must have a short code" }

        require(project.projectShortCode.matches(Regex("^[A-Z0-9]+$"))) { "Project short code must only contain uppercase letters and numbers" }

        var existingProject = projectRepository.findByTitle(project.title)
        require(existingProject == null) { "Project with title ${project.title} already exists" }

        existingProject = projectRepository.findByProjectShortCode(project.projectShortCode)
        require(existingProject == null) { "Project with short code ${project.projectShortCode} already exists" }

        var description: String? = null
        if (!project.description.isNullOrBlank()) {
            description = project.description
        }

        val newProjectModel = WorkspaceProject(
            title = project.title,
            projectShortCode = project.projectShortCode,
            description = description)
        projectRepository.save(newProjectModel)
    }

    @Transactional
    fun retrieveProjectDashboard(projectShortCode: String): ProjectDashboardDTO {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)

        val testCases = testCaseRepository.findByProjectOrderByTestCaseNumberAsc(project)
        val propertyBreakdowns = propertyConfigurationRepository.findAll()
            .filter { it.propertyType == PropertyConfigurationType.SINGLE_SELECT_LIST }
            .sortedBy { it.id }
            .map { property ->
                val values = testCases.map { testCase ->
                    testCase.propertyValues.firstOrNull { it.propertyConfiguration.id == property.id }?.value
                }
                val options = property.selectOptions.orEmpty()
                val counts = options.map { option -> ValueCountDTO(option, values.count { it == option }) }
                val notSet = values.count { it == null || it !in options }
                PropertyBreakdownDTO(property.title, if (notSet > 0) counts + ValueCountDTO("Not set", notSet) else counts)
            }

        val testRuns = testRunRepository.findAllByProject(project).sortedByDescending { it.testRunNumber }
        val summaries = testRuns.associateWith { testRun ->
            val testCaseRuns = testCaseRunRepository.findAllByTestRun(testRun)
            TestRunSummaryDTO(
                testRunID = testRun.externalID,
                testRunNumber = testRun.testRunNumber,
                title = testRun.title,
                status = testRun.status,
                creationDate = testRun.creationDate,
                createdBy = testRun.createdBy?.displayName,
                totalCount = testCaseRuns.size,
                resultCounts = TestCaseRunStatus.entries.associateWith { status -> testCaseRuns.count { it.status == status } },
            )
        }

        val activeStatuses = setOf(TestRunStatus.PENDING, TestRunStatus.IN_PROGRESS)
        return ProjectDashboardDTO(
            project = project.toDTO(),
            testCaseCount = testCases.size,
            propertyBreakdowns = propertyBreakdowns,
            testRunCounts = TestRunStatus.entries.associateWith { status -> testRuns.count { it.status == status } },
            activeTestRuns = testRuns.filter { it.status in activeStatuses }.mapNotNull { summaries[it] },
            recentTestRuns = testRuns.filter { it.status !in activeStatuses }.take(5).mapNotNull { summaries[it] },
            linkedJiraIssueCount = testCases.flatMap { testCase -> testCase.jiraLinks.map { it.issueKey } }.distinct().size,
            currentBuild = projectBuildService.currentBuild(project),
        )
    }

    /** Jira issue details, limited to issues linked to test cases in projects the user can see. */
    @Transactional
    fun retrieveJiraIssues(issueKeys: List<String>): List<JiraIssueDTO> {
        val visibleKeys = testCaseJiraLinkRepository.findAllByIssueKeyIn(issueKeys.distinct())
            .filter { projectAccessService.canAccess(CurrentUser.get(), it.testCase.project) }
            .map { it.issueKey }
            .toSet()
        return jiraService.retrieveIssues(issueKeys.filter { it in visibleKeys })
    }

    @Transactional
    fun retrieveTestCases(projectShortCode: String): List<TestCaseDTO> {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)
        val testCases = testCaseRepository.findByProjectOrderByTestCaseNumberAsc(project)
        return testCases.map { it.toDTO() }
    }

    @Transactional
    fun updateTestCase(testCaseID: UUID, updateDTO: CreateTestCaseDTO) {
        val testCase = testCaseRepository.findByExternalID(testCaseID)
        requireNotNull(testCase) { "No test case found with id $testCaseID" }
        projectAccessService.requireAccess(testCase.project)

        require(updateDTO.title.isNotBlank()) { "Test case must have a title" }

        testCase.title = updateDTO.title
        testCase.description = Tools.sanitize(updateDTO.description)
        testCase.testInstructions = Tools.sanitize(updateDTO.testInstructions)
        testCase.updatedBy = CurrentUser.get()
        testCaseRepository.save(testCase)

        // wipe property values and recreate from update request
        testCasePropertyValueRepository.deleteAll(testCase.propertyValues)
        updateTestCasePropertyValues(testCase, updateDTO.propertyValues)
    }

    @Transactional
    fun createTestCase(projectShortCode: String, testCase: CreateTestCaseDTO) {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)

        // find the test case with the largest test case number and bump it up by 1
        val largestTestCaseNumber = testCaseRepository.findTopByProjectOrderByTestCaseNumberDesc(project)?.testCaseNumber ?: 0
        createTestCaseModel(project, largestTestCaseNumber + 1, testCase)
    }

    @Transactional
    fun batchCreateTestCases(projectShortCode: String, batch: BatchCreateTestCasesDTO): Int {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)

        require(batch.testCases.isNotEmpty()) { "There must be at least one test case to import" }

        // the whole batch runs in a single transaction, so any invalid row rolls back the entire import
        var testCaseNumber = testCaseRepository.findTopByProjectOrderByTestCaseNumberDesc(project)?.testCaseNumber ?: 0
        for ((index, testCase) in batch.testCases.withIndex()) {
            testCaseNumber += 1
            try {
                createTestCaseModel(project, testCaseNumber, testCase)
            } catch (e: IllegalArgumentException) {
                throw IllegalArgumentException("Test case ${index + 1}: ${e.message}", e)
            }
        }

        return batch.testCases.size
    }

    private fun createTestCaseModel(project: WorkspaceProject, testCaseNumber: Long, testCase: CreateTestCaseDTO): TestCase {
        require(testCase.title.isNotBlank()) { "Test case must have a title" }

        val newTestCaseModel = TestCase(
            project = project,
            testCaseNumber = testCaseNumber,
            title = testCase.title,
            description = Tools.sanitize(testCase.description),
            testInstructions = Tools.sanitize(testCase.testInstructions),
            createdBy = CurrentUser.get(),
            updatedBy = CurrentUser.get(),
        )
        testCaseRepository.save(newTestCaseModel)

        updateTestCasePropertyValues(newTestCaseModel, testCase.propertyValues)
        return newTestCaseModel
    }

    @Transactional
    fun updateTestCasePropertyValues(testCase: TestCase, updatedPropertyValue: Map<UUID, String>) {
        val propertyConfigurations = propertyConfigurationRepository.findAll()
        for (propertyConfigurationModel in propertyConfigurations) {
            val propertyValue: String

            val inputPropertyValue = updatedPropertyValue[propertyConfigurationModel.externalID]
            if (propertyConfigurationModel.isRequired) {
                requireNotNull(inputPropertyValue) { "Expecting value for ${propertyConfigurationModel.title} property" }
            }
            else if (inputPropertyValue == null) {
                // skip processing this if the property is not null
                continue
            }

            when (propertyConfigurationModel.propertyType) {
                PropertyConfigurationType.TEXT -> {
                    propertyValue = inputPropertyValue
                }
                PropertyConfigurationType.NUMBER -> {
                    // todo: verify real number
                    propertyValue = inputPropertyValue
                }
                PropertyConfigurationType.SINGLE_SELECT_LIST -> {
                    val selectOptions = propertyConfigurationModel.selectOptions ?: emptyList()
                    require(selectOptions.contains(inputPropertyValue)) { "Unrecognized select option '$inputPropertyValue' for ${propertyConfigurationModel.title} property" }
                    propertyValue = inputPropertyValue
                }
            }

            val newPropertyModel = TestCasePropertyValue(
                testCase = testCase,
                propertyConfiguration = propertyConfigurationModel,
                value = propertyValue
            )
            testCasePropertyValueRepository.save(newPropertyModel)
        }
    }

    @Transactional
    fun deleteTestCase(testCaseID: UUID) {
        val testCase = testCaseRepository.findByExternalID(testCaseID)
        requireNotNull(testCase) { "No test case found with id $testCaseID" }
        projectAccessService.requireAccess(testCase.project)

        // delete all references to this test case from test case property values
        testCasePropertyValueRepository.deleteAllByTestCase(testCase)

        // delete attachments, their binary content is removed by the database cascade
        testCaseAttachmentRepository.deleteAll(testCase.attachments)

        testCaseRepository.delete(testCase)
    }

    fun retrieveProperties(): List<PropertyConfigurationDTO> {
        val properties = propertyConfigurationRepository.findAll()
        return properties.map { it.toDTO() }
    }

    fun updateProperty(property: UpdatePropertyConfigurationDTO) {
        val model = propertyConfigurationRepository.findByExternalID(property.propertyConfigurationID)
        requireNotNull(model) { "Unknown property model: ${property.propertyConfigurationID}" }

        when (model.source) {
            PropertyConfigurationSource.SYSTEM -> {
                log.error("Unable to update system property")
            }
            PropertyConfigurationSource.CUSTOMER -> {
                if (property.isRequired) {
                    require(!property.defaultValue.isNullOrBlank()) { "Required properties must have a default value" }
                }

                if (model.propertyType == PropertyConfigurationType.SINGLE_SELECT_LIST) {
                    requireNotNull(property.selectOptions) { "Missing select options configuration" }

                    if (property.defaultValue != null) {
                        require(property.selectOptions.contains(property.defaultValue)) { "Default value must be a valid option" }
                    }
                }

                // intentionally don't allow direct changing of the property type in order to reduce complexity
                // to change the type, the property should be deleted and recreated with the correct type
                model.title = property.title
                model.isRequired = property.isRequired
                model.defaultValue = property.defaultValue
                model.selectOptions = property.selectOptions
            }
        }

        propertyConfigurationRepository.save(model)
    }

    @Transactional
    fun createProperty(property: CreatePropertyConfigurationDTO) {
        if (property.propertyType == PropertyConfigurationType.SINGLE_SELECT_LIST) {
            requireNotNull(property.selectOptions) { "Missing select options configuration" }
        }

        if (property.isRequired) {
            requireNotNull(property.defaultValue) { "Missing default value" }
        }

        val newModel = PropertyConfiguration(
            source = PropertyConfigurationSource.CUSTOMER,
            title = property.title,
            propertyType = property.propertyType,
            isRequired = property.isRequired,
            defaultValue = property.defaultValue,
            selectOptions = property.selectOptions
        )

        propertyConfigurationRepository.save(newModel)

        // back-fill test cases if property value is non-null
        val defaultValue = (property.defaultValue)
        if (defaultValue != null) {
            val testCases = testCaseRepository.findAll()
            for (testCase in testCases) {
                val propertyValue = TestCasePropertyValue(
                    testCase = testCase,
                    propertyConfiguration = newModel,
                    value = defaultValue
                )
                testCasePropertyValueRepository.save(propertyValue)
            }
        }
    }

    @Transactional
    fun deleteProperty(propertyConfigurationID: UUID) {
        val propertyModel = propertyConfigurationRepository.findByExternalID(propertyConfigurationID)
        requireNotNull(propertyModel) { "Unknown property model: $propertyConfigurationID" }

        // delete all references to this property configuration from test case values
        testCasePropertyValueRepository.deleteAllByPropertyConfiguration(propertyModel)

        // finally, delete the property configuration
        propertyConfigurationRepository.delete(propertyModel)
    }

    @Transactional
    fun retrieveTestRuns(projectShortCode: String): List<TestRunDTO> {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found for id $projectShortCode" }
        projectAccessService.requireAccess(project)
        val testRuns = testRunRepository.findAllByProject(project)
        return testRuns.map { it.toDTO() }
    }

    @Transactional
    fun createTestRun(projectShortCode: String, testRun: CreateTestRunDTO) {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found for id $projectShortCode" }
        projectAccessService.requireAccess(project)

        require(testRun.testCaseIDs.isNotEmpty()) { "There must be at least one test case for the test run" }

        // find the test run with the largest test run number and bump it up by 1
        val largestTestRunNumber = testRunRepository.findTopByProjectOrderByTestRunNumberDesc(project)?.testRunNumber ?: 0
        val newTestRun = TestRun(
            project = project,
            testRunNumber = largestTestRunNumber + 1,
            status = TestRunStatus.PENDING,
            title = testRun.title,
            description = testRun.description,
            createdBy = CurrentUser.get(),
            build = testRun.buildID?.let { projectBuildService.requireBuild(project, it) },
        )
        newTestRun.assignees.addAll(projectUsersByID(project, testRun.assigneeIDs))
        testRunRepository.save(newTestRun)
        notificationService.notifyTestRunAssigned(newTestRun, newTestRun.assignees, CurrentUser.get())

        for (testCaseID in testRun.testCaseIDs) {
            val testCaseModel = testCaseRepository.findByExternalID(testCaseID)
            requireNotNull(testCaseModel) { "No test case found for id $testCaseID" }
            require(testCaseModel.project.id == project.id) { "No test case found for id $testCaseID" }
            val newTestCaseRun = TestCaseRun(
                testRun = newTestRun,
                testCase = testCaseModel,
                status = TestCaseRunStatus.PENDING,
                title = testCaseModel.title,
                description = testCaseModel.description,
                testInstructions = testCaseModel.testInstructions,
                notes = null
            )
            testCaseRunRepository.save(newTestCaseRun)
        }
    }

    @Transactional
    fun updateTestRun(testRunID: UUID, updateDTO: UpdateTestRunDTO) {
        val testRun = testRunRepository.findByExternalID(testRunID)
        requireNotNull(testRun) { "No test run found for id $testRunID" }
        projectAccessService.requireAccess(testRun.project)

        val wasComplete = testRun.status == TestRunStatus.COMPLETE
        testRun.title = updateDTO.title
        testRun.description = updateDTO.description
        testRun.status = updateDTO.status

        testRunRepository.save(testRun)
        if (!wasComplete && testRun.status == TestRunStatus.COMPLETE) {
            notificationService.notifyTestRunCompleted(testRun)
        }
    }

    @Transactional
    fun deleteTestRun(testRunID: UUID) {
        val testRun = testRunRepository.findByExternalID(testRunID)
        requireNotNull(testRun) { "No test run found for id $testRunID" }
        projectAccessService.requireAccess(testRun.project)

        // First delete all associated test case runs
        testCaseRunRepository.deleteAllByTestRun(testRun)
        
        // Then delete the test run itself
        testRunRepository.delete(testRun)
    }

    @Transactional
    fun retrieveTestCaseRuns(projectShortCode: String, testRunNumber: Long): List<TestCaseRunDTO> {
        val testRun = testRun(projectShortCode, testRunNumber)
        val testCaseRuns = testCaseRunRepository.findAllByTestRunOrderByTestCaseTestCaseNumberAsc(testRun)
        return testCaseRuns.map { it.toDTO() }
    }

    @Transactional
    fun retrieveNextTestCaseRun(testCaseRunID: UUID): TestCaseRunDTO? {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)

        if (testCaseRun.testRun.status != TestRunStatus.IN_PROGRESS) {
            log.info("Test run ${testCaseRun.testRun.id} is not eligible to auto-retrieve")
            return null
        }

        val testCaseRuns = testCaseRunRepository.findAllByTestRunOrderByTestCaseTestCaseNumberAsc(testCaseRun.testRun)

        val testCaseRunIndex = testCaseRuns.indexOfFirst { it.id == testCaseRun.id }
        require(testCaseRunIndex >= 0) { "Test case run not found in test run ${testCaseRun.testRun.externalID}" }

        // First, search from current index to end
        for (i in (testCaseRunIndex + 1) until testCaseRuns.size) {
            if (testCaseRuns[i].status == TestCaseRunStatus.PENDING) {
                return testCaseRuns[i].toDTO()
            }
        }

        // If nothing found, search from start up to current index
        for (i in 0 until testCaseRunIndex) {
            if (testCaseRuns[i].status == TestCaseRunStatus.PENDING) {
                return testCaseRuns[i].toDTO()
            }
        }

        // No pending test cases found
        return null
    }

    @Transactional
    fun updateTestCaseRun(testCaseRunID: UUID, updateDTO: UpdateTestCaseRunDTO): UpdateTestCaseRunResultDTO {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)

        // a test case taken by another tester can only be recorded by them or an admin
        val actor = CurrentUser.get()
        val assignee = testCaseRun.assignedTo
        if (assignee != null && actor != null && assignee.id != actor.id && actor.role != UserRole.ADMIN) {
            throw IllegalArgumentException("This test case is assigned to ${assignee.displayName}")
        }

        val previousStatus = testCaseRun.status
        testCaseRun.status = updateDTO.status
        testCaseRun.notes = updateDTO.notes
        testCaseRun.executedBy = actor
        if (testCaseRun.assignedTo == null) {
            testCaseRun.assignedTo = actor
        }
        testCaseRunRepository.save(testCaseRun)

        val testRun = testCaseRun.testRun
        val testCaseRuns = testCaseRunRepository.findAllByTestRun(testRun)

        val isTestRunComplete = testCaseRuns.all { it.status != TestCaseRunStatus.PENDING }
        if (isTestRunComplete && testRun.status != TestRunStatus.COMPLETE) {
            testRun.status = TestRunStatus.COMPLETE
            testRunRepository.save(testRun)
            notificationService.notifyTestRunCompleted(testRun)
        }
        else if (!isTestRunComplete && testRun.status == TestRunStatus.PENDING) {
            testRun.status = TestRunStatus.IN_PROGRESS
            testRunRepository.save(testRun)
        }

        val failedNow = updateDTO.status == TestCaseRunStatus.FAIL && previousStatus != TestCaseRunStatus.FAIL
        if (failedNow && testRun.project.jiraFailureMode == JiraFailureMode.AUTOMATIC && jiraService.isEnabled) {
            return createAutomaticJiraIssue(testCaseRun, updateDTO.appBaseURL, actor)
        }
        return UpdateTestCaseRunResultDTO()
    }

    /** Creates the Jira issue for a failure without asking for details, filling them from the test case. */
    private fun createAutomaticJiraIssue(testCaseRun: TestCaseRun, appBaseURL: String?, actor: User?): UpdateTestCaseRunResultDTO {
        // one automatic issue per test case run, even if the result is changed back and forth
        if (testCaseJiraLinkRepository.existsByTestCaseRun(testCaseRun)) return UpdateTestCaseRunResultDTO()

        val notProvided = "Not provided"
        val request = CreateJiraIssueDTO(
            summary = testCaseRun.title,
            stepsToReproduce = testCaseRun.testInstructions ?: notProvided,
            expectedResult = propertyValue(testCaseRun.testCase, "expected result") ?: notProvided,
            actualResult = testCaseRun.notes?.takeIf { it.isNotBlank() } ?: notProvided,
            buildNumber = testCaseRun.testRun.build?.buildNumber
                ?: propertyValue(testCaseRun.testCase, "build number")
                ?: notProvided,
            appBaseURL = appBaseURL,
        )

        return try {
            UpdateTestCaseRunResultDTO(jiraIssueKey = createJiraIssueFor(testCaseRun, request).issueKey)
        } catch (e: IllegalArgumentException) {
            // the result is still saved, the user is told the issue is missing
            val message = e.message ?: "unknown error"
            actor?.let { notificationService.notifyJiraIssueFailed(it, testCaseRun.testRun, testCaseRun.title, message) }
            UpdateTestCaseRunResultDTO(jiraError = message)
        }
    }

    private fun propertyValue(testCase: TestCase, title: String): String? {
        return testCase.propertyValues
            .firstOrNull { it.propertyConfiguration.title.trim().lowercase() == title }
            ?.value?.takeIf { it.isNotBlank() }
    }

    @Transactional
    fun updateTestRunBuild(testRunID: UUID, request: UpdateTestRunBuildDTO): TestRunDTO {
        val testRun = testRunRepository.findByExternalID(testRunID)
        requireNotNull(testRun) { "No test run found for id $testRunID" }
        projectAccessService.requireAccess(testRun.project)
        require(!testRun.isClosed) { "The build can't be changed once the test run is closed" }

        testRun.build = request.buildID?.let { projectBuildService.requireBuild(testRun.project, it) }
        testRunRepository.save(testRun)
        return testRun.toDTO()
    }

    @Transactional
    fun updateTestRunAssignees(testRunID: UUID, request: UpdateTestRunAssigneesDTO): TestRunDTO {
        val testRun = testRunRepository.findByExternalID(testRunID)
        requireNotNull(testRun) { "No test run found for id $testRunID" }
        projectAccessService.requireAccess(testRun.project)
        require(!testRun.isClosed) { "Assignments can't be changed once the test run is closed" }

        val assignees = projectUsersByID(testRun.project, request.userIDs)
        val added = assignees.filter { user -> testRun.assignees.none { it.id == user.id } }
        val removedIDs = testRun.assignees.map { it.id }.toSet() - assignees.map { it.id }.toSet()

        testRun.assignees.clear()
        testRun.assignees.addAll(assignees)
        testRunRepository.save(testRun)

        // pending test cases taken by people no longer on the test run become available again
        if (removedIDs.isNotEmpty()) {
            testCaseRunRepository.findAllByTestRun(testRun)
                .filter { it.status == TestCaseRunStatus.PENDING && it.assignedTo?.id in removedIDs }
                .forEach { it.assignedTo = null; testCaseRunRepository.save(it) }
        }

        notificationService.notifyTestRunAssigned(testRun, added, CurrentUser.get())
        return testRun.toDTO()
    }

    @Transactional
    fun updateTestCaseRunAssignee(testCaseRunID: UUID, request: UpdateTestCaseRunAssigneeDTO): TestCaseRunDTO {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        val testRun = testCaseRun.testRun
        projectAccessService.requireAccess(testRun.project)
        require(!testRun.isClosed) { "Assignments can't be changed once the test run is closed" }

        val actor = requireNotNull(CurrentUser.get()) { "Not signed in" }
        val newAssignee = request.userID?.let { projectUsersByID(testRun.project, listOf(it)).single() }

        if (actor.role != UserRole.ADMIN) {
            // testers can take an available test case or give back their own, admins can reassign anything
            val current = testCaseRun.assignedTo
            val takesAvailable = newAssignee?.id == actor.id && current == null
            val releasesOwn = newAssignee == null && current?.id == actor.id
            require(takesAvailable || releasesOwn) {
                if (current != null && current.id != actor.id) "This test case is assigned to ${current.displayName}"
                else "Only admins can assign test cases to other users"
            }
        }

        testCaseRun.assignedTo = newAssignee
        testCaseRunRepository.save(testCaseRun)
        return testCaseRun.toDTO()
    }

    @Transactional
    fun retrieveProjectUsers(projectShortCode: String): List<UserSummaryDTO> {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)
        // the super admin isn't offered when assigning test runs or test cases
        return projectAccessService.projectUsers(project)
            .filter { !it.isSuperAdmin }
            .map { UserSummaryDTO(it.externalID, it.displayName) }
    }

    @Transactional
    fun updateProjectSettings(projectShortCode: String, request: UpdateProjectSettingsDTO): WorkspaceProjectDTO {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found" }
        projectAccessService.requireAccess(project)

        val jiraProjectKey = request.jiraProjectKey?.trim()?.uppercase()?.takeIf { it.isNotEmpty() }
        if (jiraProjectKey != null) {
            require(jiraProjectKey.matches(Regex("^[A-Z][A-Z0-9_]+$"))) { "'$jiraProjectKey' is not a valid Jira project key, e.g. SCRUM" }
            if (jiraService.isEnabled) {
                jiraService.requireProject(jiraProjectKey)
            }
        }

        // the issue type, chosen or default, must exist in the space issues are created in
        val jiraIssueType = request.jiraIssueType?.trim()?.takeIf { it.isNotEmpty() }
        if ((jiraIssueType != null || jiraProjectKey != null) && jiraService.isEnabled) {
            val targetProjectKey = jiraProjectKey ?: jiraService.defaultProjectKey
            val targetIssueType = jiraIssueType ?: jiraService.defaultIssueType
            val issueTypes = jiraService.listIssueTypes(targetProjectKey)
            require(issueTypes.any { it.name == targetIssueType }) { "Jira project $targetProjectKey has no issue type named '$targetIssueType'" }
        }

        project.jiraFailureMode = request.jiraFailureMode
        project.jiraProjectKey = jiraProjectKey
        project.jiraIssueType = jiraIssueType
        projectRepository.save(project)
        return project.toDTO()
    }

    /** Resolves user IDs, accepting only active users that can see the project. */
    private fun projectUsersByID(project: WorkspaceProject, userIDs: List<UUID>): List<User> {
        return userIDs.distinct().map { userID ->
            val user = userRepository.findByExternalID(userID)
            require(user != null && user.isActive && projectAccessService.canAccess(user, project)) {
                "No user with access to ${project.title} found with id $userID"
            }
            user
        }
    }

    @Transactional
    fun updateTestCaseRunDetails(testCaseRunID: UUID, updateDTO: UpdateTestCaseRunDetailsDTO) {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)

        require(updateDTO.title.isNotBlank()) { "Test case must have a title" }

        testCaseRun.title = updateDTO.title
        testCaseRun.description = Tools.sanitize(updateDTO.description)
        testCaseRun.testInstructions = Tools.sanitize(updateDTO.testInstructions)
        testCaseRunRepository.save(testCaseRun)

        if (updateDTO.applyToTestCase) {
            val testCase = testCaseRun.testCase
            testCase.title = testCaseRun.title
            testCase.description = testCaseRun.description
            testCase.testInstructions = testCaseRun.testInstructions
            testCase.updatedBy = CurrentUser.get()
            testCaseRepository.save(testCase)
        }
    }

    @Transactional
    fun deleteTestCaseRun(testCaseRunID: UUID) {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)
        testCaseRunRepository.delete(testCaseRun)
    }

    @Transactional
    fun uploadTestCaseAttachments(testCaseID: UUID, files: List<MultipartFile>): List<TestCaseAttachmentDTO> {
        val testCase = testCaseRepository.findByExternalID(testCaseID)
        requireNotNull(testCase) { "No test case found with id $testCaseID" }
        projectAccessService.requireAccess(testCase.project)

        require(files.isNotEmpty()) { "At least one file is required" }

        return files.map { file ->
            val fileName = file.originalFilename?.takeIf { it.isNotBlank() } ?: "attachment"
            val contentType = file.contentType ?: ""
            require(isSupportedMediaType(contentType)) { "Unsupported file type for $fileName, only images and videos are allowed" }
            require(!file.isEmpty) { "File $fileName is empty" }

            val attachment = TestCaseAttachment(
                testCase = testCase,
                fileName = fileName,
                contentType = contentType,
                fileSize = file.size,
                uploadedBy = CurrentUser.get(),
            )
            testCaseAttachmentRepository.save(attachment)
            testCaseAttachmentContentRepository.save(TestCaseAttachmentContent(attachment = attachment, data = file.bytes))
            attachment.toDTO()
        }
    }

    @Transactional
    fun retrieveAttachmentContent(attachmentID: UUID): AttachmentContentDTO {
        val attachment = testCaseAttachmentRepository.findByExternalID(attachmentID)
        requireNotNull(attachment) { "No attachment found with id $attachmentID" }
        projectAccessService.requireAccess(attachment.testCase.project)

        val content = testCaseAttachmentContentRepository.findByAttachment(attachment)
        requireNotNull(content) { "No content found for attachment $attachmentID" }

        return AttachmentContentDTO(attachment.fileName, attachment.contentType, content.data)
    }

    @Transactional
    fun deleteAttachment(attachmentID: UUID) {
        val attachment = testCaseAttachmentRepository.findByExternalID(attachmentID)
        requireNotNull(attachment) { "No attachment found with id $attachmentID" }
        projectAccessService.requireAccess(attachment.testCase.project)

        testCaseAttachmentContentRepository.deleteAllByAttachment(attachment)
        testCaseAttachmentRepository.delete(attachment)
    }

    @Transactional
    fun createJiraIssue(testCaseRunID: UUID, request: CreateJiraIssueDTO): JiraLinkDTO {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)
        require(testCaseRun.testRun.project.jiraFailureMode != JiraFailureMode.DISABLED) { "Creating Jira issues is disabled for this project" }

        return createJiraIssueFor(testCaseRun, request)
    }

    @Transactional
    fun searchSimilarJiraIssues(testCaseRunID: UUID, summary: String): List<SimilarJiraIssueDTO> {
        val testCaseRun = testCaseRunRepository.findByExternalID(testCaseRunID)
        requireNotNull(testCaseRun) { "No test case found for id $testCaseRunID" }
        projectAccessService.requireAccess(testCaseRun.testRun.project)
        return jiraService.searchSimilar(summary, testCaseRun.testRun.project.jiraProjectKey)
    }

    private fun createJiraIssueFor(testCaseRun: TestCaseRun, request: CreateJiraIssueDTO): JiraLinkDTO {
        require(request.summary.isNotBlank()) { "Summary is required" }
        require(request.stepsToReproduce.isNotBlank()) { "Steps to reproduce are required" }
        require(request.expectedResult.isNotBlank()) { "Expected result is required" }
        require(request.actualResult.isNotBlank()) { "Actual result is required" }
        require(request.buildNumber.isNotBlank()) { "Build number is required" }

        val testCase = testCaseRun.testCase
        val project = testCase.project
        val appBaseURL = sanitizeBaseURL(request.appBaseURL)

        val description = JiraDocument()
            .heading("Steps to reproduce").paragraph(request.stepsToReproduce)
            .heading("Expected result").paragraph(request.expectedResult)
            .heading("Actual result").paragraph(request.actualResult)
            .heading("Build number").paragraph(request.buildNumber)

        if (appBaseURL != null) {
            // media stays in SparkyTC and is only linked, so the issue doesn't use jira storage
            if (testCase.attachments.isNotEmpty()) {
                description.heading("Evidence")
                    .links(testCase.attachments.map { it.fileName to "$appBaseURL/attachments/${it.externalID}" })
            }
            description.heading("SparkyTC").links(listOf(
                "Test case ${project.projectShortCode}-${testCase.testCaseNumber}" to testCaseURL(appBaseURL, testCase),
                "Test run #${testCaseRun.testRun.testRunNumber}: ${testCaseRun.testRun.title}" to
                    "$appBaseURL/test-runs/${project.projectShortCode}/${testCaseRun.testRun.testRunNumber}/${testCase.testCaseNumber}",
            ))
        }

        CurrentUser.get()?.let { description.paragraph("Reported from SparkyTC by ${it.displayName}") }

        val issueKey = jiraService.createIssue(request.summary.trim(), description.build(), project.jiraProjectKey, project.jiraIssueType)
        if (appBaseURL != null) {
            jiraService.addRemoteLink(issueKey, testCaseURL(appBaseURL, testCase), testCaseLinkTitle(testCase))
        }

        val link = TestCaseJiraLink(testCase = testCase, issueKey = issueKey, issueURL = jiraService.issueURL(issueKey), testCaseRun = testCaseRun)
        testCaseJiraLinkRepository.save(link)
        return link.toDTO()
    }

    @Transactional
    fun linkJiraIssue(testCaseID: UUID, request: LinkJiraIssueDTO): JiraLinkDTO {
        val testCase = testCaseRepository.findByExternalID(testCaseID)
        requireNotNull(testCase) { "No test case found with id $testCaseID" }
        projectAccessService.requireAccess(testCase.project)

        val issueKey = JiraService.parseIssueKey(request.issue)
        requireNotNull(issueKey) { "'${request.issue}' is not a valid Jira issue key, e.g. SCRUM-123" }

        val existingLink = testCaseJiraLinkRepository.findByTestCaseAndIssueKey(testCase, issueKey)
        require(existingLink == null) { "$issueKey is already linked to this test case" }

        // verifies the issue exists and resolves its canonical key
        val issue = jiraService.retrieveIssue(issueKey)

        val appBaseURL = sanitizeBaseURL(request.appBaseURL)
        if (appBaseURL != null) {
            jiraService.addRemoteLink(issue.issueKey, testCaseURL(appBaseURL, testCase), testCaseLinkTitle(testCase))
        }

        val link = TestCaseJiraLink(testCase = testCase, issueKey = issue.issueKey, issueURL = issue.issueURL)
        testCaseJiraLinkRepository.save(link)
        return link.toDTO()
    }

    @Transactional
    fun deleteJiraLink(linkID: UUID) {
        val link = testCaseJiraLinkRepository.findByExternalID(linkID)
        requireNotNull(link) { "No Jira link found with id $linkID" }
        projectAccessService.requireAccess(link.testCase.project)

        // only the link in SparkyTC is removed, the jira issue is left untouched
        testCaseJiraLinkRepository.delete(link)
    }

    private fun sanitizeBaseURL(url: String?): String? {
        val trimmed = url?.trim()?.trimEnd('/')
        if (trimmed.isNullOrBlank()) return null
        return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else null
    }

    private fun testCaseURL(appBaseURL: String, testCase: TestCase): String {
        return "$appBaseURL/test-cases/${testCase.project.projectShortCode}/${testCase.testCaseNumber}"
    }

    private fun testCaseLinkTitle(testCase: TestCase): String {
        return "SparkyTC ${testCase.project.projectShortCode}-${testCase.testCaseNumber}: ${testCase.title}"
    }

    private fun isSupportedMediaType(contentType: String): Boolean {
        return contentType.startsWith("image/") || contentType.startsWith("video/")
    }

    @Transactional
    fun exportTestRunAsDocx(projectShortCode: String, testRunNumber: Long, exportType: TestRunExportType): DocumentDTO<ByteArray> {
        val testRun = testRun(projectShortCode, testRunNumber)
        val testCaseRuns = testCaseRunRepository.findAllByTestRunOrderByTestCaseTestCaseNumberAsc(testRun)

        val sections = testCaseRuns.map { testCaseRun ->
            val subsections = mutableListOf<Subsection>()

            when (exportType) {
                TestRunExportType.PLAN -> {
                    subsections.add(
                        Subsection(
                            title = "Description",
                            body = testCaseRun.description ?: "No description provided"
                        )
                    )
                }
                TestRunExportType.RESULTS -> {
                    subsections.add(
                        Subsection(
                            title = "Status",
                            body = testCaseRun.status.toString()
                        )
                    )

                    val notes = testCaseRun.notes
                    if (!notes.isNullOrBlank()) {
                        subsections.add(
                            Subsection(
                                title = "Notes",
                                body = notes
                            )
                        )
                    }
                }
            }

            Section(
                title = "${testCaseRun.testCase.project.projectShortCode}-${testCaseRun.testCase.testCaseNumber} - ${testCaseRun.title}",
                subsections = subsections
            )
        }

        val documentTitle = when (exportType) {
            TestRunExportType.PLAN -> "Test Plan: ${testRun.title}"
            TestRunExportType.RESULTS -> "Test Results: ${testRun.title}"
        }

        val generateDocumentDTO = GenerateDocumentDTO(
            title = documentTitle,
            description = testRun.description ?: "No description provided",
            sections = sections
        )

        val documentData = createDocx(generateDocumentDTO)
        return DocumentDTO("${testRun.title}.docx", documentData)
    }

    private fun testRun(
        projectShortCode: String,
        testRunNumber: Long
    ): TestRun {
        val project = projectRepository.findByProjectShortCode(projectShortCode)
        requireNotNull(project) { "No project found for id $projectShortCode" }
        projectAccessService.requireAccess(project)

        val testRun = testRunRepository.findByProjectAndTestRunNumber(project, testRunNumber)
        requireNotNull(testRun) { "No test run found with test run number $testRunNumber" }
        return testRun
    }

    private fun createDocx(documentModel: GenerateDocumentDTO): ByteArray {
        val documentFontFamily = "Arial"

        val doc = XWPFDocument()

        // Add page numbers to footer
        val footer = doc.createFooter(HeaderFooterType.DEFAULT)
        val footerParagraph = footer.createParagraph().apply {
            alignment = ParagraphAlignment.CENTER
        }
        footerParagraph.createRun().apply {
            fontSize = 10
            fontFamily = documentFontFamily
            setText("Page ")
        }

        // Create a run for the PAGE field
        val pageRun = footerParagraph.createRun().apply {
            fontSize = 10
            fontFamily = documentFontFamily
        }
        pageRun.ctr.addNewFldChar().fldCharType = STFldCharType.BEGIN
        pageRun.ctr.addNewInstrText().stringValue = " PAGE "
        pageRun.ctr.addNewFldChar().fldCharType = STFldCharType.END

        footerParagraph.createRun().apply {
            fontSize = 10
            fontFamily = documentFontFamily
            setText("/")
        }

        // Create a run for the NUMPAGES field
        val numPagesRun = footerParagraph.createRun().apply {
            fontSize = 10
            fontFamily = documentFontFamily
        }
        numPagesRun.ctr.addNewFldChar().fldCharType = STFldCharType.BEGIN
        numPagesRun.ctr.addNewInstrText().stringValue = " NUMPAGES "
        numPagesRun.ctr.addNewFldChar().fldCharType = STFldCharType.END

        // Title
        val titleParagraph = doc.createParagraph().apply {
            alignment = ParagraphAlignment.CENTER
        }
        titleParagraph.createRun().apply {
            isBold = true
            fontSize = 20
            fontFamily = documentFontFamily
            setText(documentModel.title)
        }

        // Description
        val descriptionParagraph = doc.createParagraph()
        descriptionParagraph.createRun().apply {
            fontSize = 12
            fontFamily = documentFontFamily
            setText(documentModel.description)
        }

        // Sections
        for (section: Section in documentModel.sections) {
            val sectionParagraph = doc.createParagraph().apply {
                spacingBefore = 200
            }
            sectionParagraph.createRun().apply {
                isBold = true
                fontSize = 16
                fontFamily = documentFontFamily
                setText(section.title)
            }

            // Subsections
            for ((index, subsection) in section.subsections.withIndex()) {
                // Add extra spacing before subsections (except the first one)
                if (index > 0) {
                    doc.createParagraph()
                }

                val subsectionTitleParagraph = doc.createParagraph()
                subsectionTitleParagraph.createRun().apply {
                    isItalic = true
                    underline = UnderlinePatterns.SINGLE
                    fontSize = 14
                    fontFamily = documentFontFamily
                    setText(subsection.title)
                }

                val subsectionBodyParagraph = doc.createParagraph()
                subsectionBodyParagraph.createRun().apply {
                    fontSize = 12
                    fontFamily = documentFontFamily
                    setText(subsection.body)
                }
            }
        }

        val outputStream = ByteArrayOutputStream()
        doc.write(outputStream)
        doc.close()

        return outputStream.toByteArray()
    }
}