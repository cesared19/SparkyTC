package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.AdminOnly
import com.sparkytc.sparkytcservice.dto.*
import com.sparkytc.sparkytcservice.dto.builds.SaveProjectBuildDTO
import com.sparkytc.sparkytcservice.dto.jira.CreateJiraIssueDTO
import com.sparkytc.sparkytcservice.dto.jira.JiraReporterPermissionDTO
import com.sparkytc.sparkytcservice.dto.jira.LinkJiraIssueDTO
import com.sparkytc.sparkytcservice.dto.projects.UpdateProjectSettingsDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestCaseRunAssigneeDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestRunAssigneesDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestRunBuildDTO
import com.sparkytc.sparkytcservice.dto.projects.CreateWorkspaceProjectDTO
import com.sparkytc.sparkytcservice.dto.properties.CreatePropertyConfigurationDTO
import com.sparkytc.sparkytcservice.dto.properties.UpdatePropertyConfigurationDTO
import com.sparkytc.sparkytcservice.dto.testcases.BatchCreateTestCasesDTO
import com.sparkytc.sparkytcservice.dto.testcases.CreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.testruns.CreateTestRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.RerunTestRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestCaseRunDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestCaseRunDetailsDTO
import com.sparkytc.sparkytcservice.dto.testruns.UpdateTestRunDTO
import com.sparkytc.sparkytcservice.services.BuildResultsService
import com.sparkytc.sparkytcservice.dto.time.UpdateTestRunTimeDTO
import com.sparkytc.sparkytcservice.services.JiraService
import com.sparkytc.sparkytcservice.services.TestCaseResultService
import com.sparkytc.sparkytcservice.services.TestCaseSectionService
import com.sparkytc.sparkytcservice.services.StepService
import com.sparkytc.sparkytcservice.services.TestPlanService
import com.sparkytc.sparkytcservice.services.BulkEditService
import com.sparkytc.sparkytcservice.services.ResultDraftService
import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunDraftDTO
import com.sparkytc.sparkytcservice.dto.bulk.BulkAssignTestCaseRunsDTO
import com.sparkytc.sparkytcservice.dto.bulk.BulkDeleteTestCasesDTO
import com.sparkytc.sparkytcservice.dto.bulk.BulkEditTestCasesDTO
import com.sparkytc.sparkytcservice.dto.plans.SaveTestPlanDTO
import com.sparkytc.sparkytcservice.dto.steps.SaveSharedStepDTO
import com.sparkytc.sparkytcservice.dto.sections.*
import com.sparkytc.sparkytcservice.services.TimeTrackingService
import com.sparkytc.sparkytcservice.services.ProjectBuildService
import com.sparkytc.sparkytcservice.services.WorkspaceService
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.Resource
import org.springframework.http.ContentDisposition
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

@RestController
@RequestMapping("/api/v1/workspace")
class WorkspaceController(
    private val workspaceService: WorkspaceService,
    private val jiraService: JiraService,
    private val projectBuildService: ProjectBuildService,
    private val buildResultsService: BuildResultsService,
    private val timeTrackingService: TimeTrackingService,
    private val testCaseResultService: TestCaseResultService,
    private val sectionService: TestCaseSectionService,
    private val stepService: StepService,
    private val testPlanService: TestPlanService,
    private val bulkEditService: BulkEditService,
    private val resultDraftService: ResultDraftService,
) {

    @GetMapping("/projects")
    fun retrieveProjects(): ResponseEntity<Any> {
        val projects = workspaceService.retrieveProjects()
        return ResponseEntity.ok(DataResponse(data = projects))
    }

    @AdminOnly
    @PostMapping("/projects")
    fun createProject(@RequestBody request: CreateWorkspaceProjectDTO): ResponseEntity<Any> {
        workspaceService.createProject(request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/projects/{projectShortCode}/users")
    fun retrieveProjectUsers(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.retrieveProjectUsers(projectShortCode)))
    }

    @AdminOnly
    @PutMapping("/projects/{projectShortCode}/settings")
    fun updateProjectSettings(@PathVariable projectShortCode: String, @RequestBody request: UpdateProjectSettingsDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.updateProjectSettings(projectShortCode, request)))
    }

    @GetMapping("/projects/{projectShortCode}/builds")
    fun retrieveBuilds(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = projectBuildService.retrieveBuilds(projectShortCode)))
    }

    @GetMapping("/projects/{projectShortCode}/build-results")
    fun retrieveBuildResults(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = buildResultsService.retrieveBuildResults(projectShortCode)))
    }

    @AdminOnly
    @PostMapping("/projects/{projectShortCode}/builds")
    fun createBuild(@PathVariable projectShortCode: String, @RequestBody request: SaveProjectBuildDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = projectBuildService.createBuild(projectShortCode, request)))
    }

    @AdminOnly
    @PutMapping("/builds/{buildID}")
    fun updateBuild(@PathVariable buildID: UUID, @RequestBody request: SaveProjectBuildDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = projectBuildService.updateBuild(buildID, request)))
    }

    @AdminOnly
    @DeleteMapping("/builds/{buildID}")
    fun deleteBuild(@PathVariable buildID: UUID): ResponseEntity<Any> {
        projectBuildService.deleteBuild(buildID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PostMapping("/test-case-runs/{testCaseRunID}/timer/start")
    fun startTimer(@PathVariable testCaseRunID: UUID): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = timeTrackingService.startTimer(testCaseRunID)))
    }

    @PostMapping("/test-case-runs/{testCaseRunID}/timer/pause")
    fun pauseTimer(@PathVariable testCaseRunID: UUID): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = timeTrackingService.pauseTimer(testCaseRunID)))
    }

    @GetMapping("/test-runs/{testRunID}/time")
    fun retrieveTestRunTime(@PathVariable testRunID: UUID): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = timeTrackingService.retrieveTestRunTime(testRunID)))
    }

    @AdminOnly
    @PutMapping("/test-runs/{testRunID}/time")
    fun updateTestRunTime(@PathVariable testRunID: UUID, @RequestBody request: UpdateTestRunTimeDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = timeTrackingService.updateTestRunTime(testRunID, request)))
    }

    @PutMapping("/test-runs/{testRunID}/build")
    fun updateTestRunBuild(@PathVariable testRunID: UUID, @RequestBody request: UpdateTestRunBuildDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.updateTestRunBuild(testRunID, request)))
    }

    @AdminOnly
    @PutMapping("/test-runs/{testRunID}/assignees")
    fun updateTestRunAssignees(@PathVariable testRunID: UUID, @RequestBody request: UpdateTestRunAssigneesDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.updateTestRunAssignees(testRunID, request)))
    }

    @PutMapping("/test-case-runs/{testCaseRunID}/assignee")
    fun updateTestCaseRunAssignee(@PathVariable testCaseRunID: UUID, @RequestBody request: UpdateTestCaseRunAssigneeDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.updateTestCaseRunAssignee(testCaseRunID, request)))
    }

    @GetMapping("/test-case-runs/{testCaseRunID}/similar-jira-issues")
    fun retrieveSimilarJiraIssues(@PathVariable testCaseRunID: UUID, @RequestParam("summary") summary: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.searchSimilarJiraIssues(testCaseRunID, summary)))
    }

    @GetMapping("/projects/{projectShortCode}/dashboard")
    fun retrieveProjectDashboard(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.retrieveProjectDashboard(projectShortCode)))
    }

    @GetMapping("/projects/{projectShortCode}/test-plans")
    fun retrieveTestPlans(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = testPlanService.retrieveTestPlans(projectShortCode)))
    }

    @PostMapping("/projects/{projectShortCode}/test-plans")
    fun createTestPlan(@PathVariable projectShortCode: String, @RequestBody request: SaveTestPlanDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = testPlanService.createTestPlan(projectShortCode, request)))
    }

    @PutMapping("/test-plans/{testPlanID}")
    fun updateTestPlan(@PathVariable testPlanID: UUID, @RequestBody request: SaveTestPlanDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = testPlanService.updateTestPlan(testPlanID, request)))
    }

    @AdminOnly
    @DeleteMapping("/test-plans/{testPlanID}")
    fun deleteTestPlan(@PathVariable testPlanID: UUID): ResponseEntity<Any> {
        testPlanService.deleteTestPlan(testPlanID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/projects/{projectShortCode}/shared-steps")
    fun retrieveSharedSteps(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = stepService.retrieveSharedSteps(projectShortCode)))
    }

    @PostMapping("/projects/{projectShortCode}/shared-steps")
    fun createSharedStep(@PathVariable projectShortCode: String, @RequestBody request: SaveSharedStepDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = stepService.createSharedStep(projectShortCode, request)))
    }

    @PutMapping("/shared-steps/{sharedStepID}")
    fun updateSharedStep(@PathVariable sharedStepID: UUID, @RequestBody request: SaveSharedStepDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = stepService.updateSharedStep(sharedStepID, request)))
    }

    @DeleteMapping("/shared-steps/{sharedStepID}")
    fun deleteSharedStep(@PathVariable sharedStepID: UUID): ResponseEntity<Any> {
        stepService.deleteSharedStep(sharedStepID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/projects/{projectShortCode}/sections")
    fun retrieveSections(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = sectionService.retrieveSections(projectShortCode)))
    }

    @PostMapping("/projects/{projectShortCode}/sections")
    fun createSection(@PathVariable projectShortCode: String, @RequestBody request: CreateTestCaseSectionDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = sectionService.createSection(projectShortCode, request)))
    }

    @PutMapping("/sections/{sectionID}")
    fun updateSection(@PathVariable sectionID: UUID, @RequestBody request: UpdateTestCaseSectionDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = sectionService.updateSection(sectionID, request)))
    }

    @PostMapping("/sections/{sectionID}/reorder")
    fun reorderSection(@PathVariable sectionID: UUID, @RequestBody request: ReorderTestCaseSectionDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = sectionService.reorderSection(sectionID, request)))
    }

    @DeleteMapping("/sections/{sectionID}")
    fun deleteSection(@PathVariable sectionID: UUID): ResponseEntity<Any> {
        sectionService.deleteSection(sectionID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PutMapping("/test-cases/bulk")
    fun bulkEditTestCases(@RequestBody request: BulkEditTestCasesDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = bulkEditService.editTestCases(request)))
    }

    // deleting test cases is restricted to admins, one at a time or several
    @AdminOnly
    @PostMapping("/test-cases/bulk-delete")
    fun bulkDeleteTestCases(@RequestBody request: BulkDeleteTestCasesDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = bulkEditService.deleteTestCases(request)))
    }

    // the current user's unsaved result for a test case in a run; empty when there's none
    @GetMapping("/test-case-runs/{testCaseRunID}/draft")
    fun retrieveResultDraft(@PathVariable testCaseRunID: UUID): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = resultDraftService.retrieveDraft(testCaseRunID) ?: TestCaseRunDraftDTO()))
    }

    @PutMapping("/test-case-runs/{testCaseRunID}/draft")
    fun saveResultDraft(@PathVariable testCaseRunID: UUID, @RequestBody request: TestCaseRunDraftDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = resultDraftService.saveDraft(testCaseRunID, request) ?: TestCaseRunDraftDTO()))
    }

    @DeleteMapping("/test-case-runs/{testCaseRunID}/draft")
    fun discardResultDraft(@PathVariable testCaseRunID: UUID): ResponseEntity<Any> {
        resultDraftService.discardDraft(testCaseRunID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PutMapping("/test-case-runs/bulk-assignee")
    fun bulkAssignTestCaseRuns(@RequestBody request: BulkAssignTestCaseRunsDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = bulkEditService.assignTestCaseRuns(request)))
    }

    @GetMapping("test-cases/{projectShortCode}")
    fun retrieveTestCases(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        val testCases = workspaceService.retrieveTestCases(projectShortCode)
        return ResponseEntity.ok(DataResponse(data = testCases))
    }

    @PostMapping("/test-cases/{projectShortCode}")
    fun createTestCase(@PathVariable projectShortCode: String, @RequestBody request: CreateTestCaseDTO): ResponseEntity<Any> {
        workspaceService.createTestCase(projectShortCode, request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PostMapping("/test-cases/{projectShortCode}/batch")
    fun batchCreateTestCases(@PathVariable projectShortCode: String, @RequestBody request: BatchCreateTestCasesDTO): ResponseEntity<Any> {
        val createdCount = workspaceService.batchCreateTestCases(projectShortCode, request)
        return ResponseEntity.ok(DataResponse(data = mapOf("createdCount" to createdCount)))
    }

    @PostMapping("/test-cases/{testCaseID}/attachments", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadTestCaseAttachments(@PathVariable testCaseID: UUID, @RequestPart("files") files: List<MultipartFile>): ResponseEntity<Any> {
        val attachments = workspaceService.uploadTestCaseAttachments(testCaseID, files)
        return ResponseEntity.ok(DataResponse(data = attachments))
    }

    @PostMapping("/test-case-results/{resultID}/attachments", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadResultEvidence(@PathVariable resultID: UUID, @RequestPart("files") files: List<MultipartFile>): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = testCaseResultService.uploadEvidence(resultID, files)))
    }

    @AdminOnly
    @DeleteMapping("/test-case-results/{resultID}")
    fun deleteResult(@PathVariable resultID: UUID): ResponseEntity<Any> {
        testCaseResultService.deleteResult(resultID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/test-cases/{testCaseID}/history")
    fun retrieveTestCaseHistory(@PathVariable testCaseID: UUID): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = testCaseResultService.retrieveHistory(testCaseID)))
    }

    @GetMapping("/attachments/{attachmentID}")
    fun retrieveAttachment(@PathVariable attachmentID: UUID): ResponseEntity<Resource> {
        val content = workspaceService.retrieveAttachmentContent(attachmentID)

        // returning a Resource lets Spring honor HTTP range requests, which browsers rely on for video seeking
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(content.fileName, Charsets.UTF_8).build().toString())
            .contentType(MediaType.parseMediaType(content.contentType))
            .body(ByteArrayResource(content.data))
    }

    @DeleteMapping("/attachments/{attachmentID}")
    fun deleteAttachment(@PathVariable attachmentID: UUID): ResponseEntity<Any> {
        workspaceService.deleteAttachment(attachmentID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PutMapping("/test-cases/{testCaseID}")
    fun updateTestCase(@PathVariable testCaseID: UUID, @RequestBody request: CreateTestCaseDTO): ResponseEntity<Any> {
        workspaceService.updateTestCase(testCaseID, request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @AdminOnly
    @DeleteMapping("/test-cases/{testCaseID}")
    fun deleteTestCase(@PathVariable testCaseID: UUID): ResponseEntity<Any> {
        workspaceService.deleteTestCase(testCaseID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/properties")
    fun getWorkspaceProperties(): ResponseEntity<Any> {
        val properties = workspaceService.retrieveProperties()
        return ResponseEntity.ok(DataResponse(data = properties))
    }

    @AdminOnly
    @PutMapping("/properties")
    fun updateProperties(@RequestBody request: UpdatePropertyConfigurationDTO): ResponseEntity<Any> {
        workspaceService.updateProperty(request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @AdminOnly
    @PostMapping("/properties")
    fun createProperty(@RequestBody request: CreatePropertyConfigurationDTO): ResponseEntity<Any> {
        workspaceService.createProperty(request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @AdminOnly
    @DeleteMapping("/properties/{propertyConfigurationID}")
    fun deleteProperty(@PathVariable propertyConfigurationID: UUID): ResponseEntity<Any> {
        workspaceService.deleteProperty(propertyConfigurationID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/test-runs/{projectShortCode}")
    fun retrieveTestRuns(@PathVariable projectShortCode: String): ResponseEntity<Any> {
        val testRuns = workspaceService.retrieveTestRuns(projectShortCode)
        return ResponseEntity.ok(DataResponse(data = testRuns))
    }

    @GetMapping("/projects/{projectShortCode}/test-runs/{testRunNumber}")
    fun retrieveTestRun(@PathVariable projectShortCode: String, @PathVariable testRunNumber: Long): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.retrieveTestRun(projectShortCode, testRunNumber)))
    }

    @PostMapping("/test-runs/{testRunID}/rerun")
    fun rerunTestRun(@PathVariable testRunID: UUID, @RequestBody request: RerunTestRunDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.rerunTestRun(testRunID, request)))
    }

    @PostMapping("/test-runs/{projectShortCode}")
    fun createTestRun(@PathVariable projectShortCode: String, @RequestBody request: CreateTestRunDTO): ResponseEntity<Any> {
        workspaceService.createTestRun(projectShortCode, request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PutMapping("/test-runs/{testRunID}")
    fun updateTestRun(@PathVariable testRunID: UUID, @RequestBody request: UpdateTestRunDTO): ResponseEntity<Any> {
        workspaceService.updateTestRun(testRunID, request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @AdminOnly
    @DeleteMapping("/test-runs/{testRunID}")
    fun deleteTestRun(@PathVariable testRunID: UUID): ResponseEntity<Any> {
        workspaceService.deleteTestRun(testRunID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/test-case-runs/{projectShortCode}/{testRunNumber}")
    fun retrieveTestCaseRuns(@PathVariable projectShortCode: String, @PathVariable testRunNumber: Long): ResponseEntity<Any> {
        val testCaseRuns = workspaceService.retrieveTestCaseRuns(projectShortCode, testRunNumber)
        return ResponseEntity.ok(DataResponse(data = testCaseRuns))
    }

    @GetMapping("/test-case-runs/{testCaseRunID}/next")
    fun retrieveNextTestCaseRun(@PathVariable testCaseRunID: UUID): ResponseEntity<Any> {
        val testCaseRun = workspaceService.retrieveNextTestCaseRun(testCaseRunID)
        return ResponseEntity.ok(DataResponse(data = testCaseRun))
    }

    @PutMapping("/test-case-runs/{testCaseRunID}")
    fun updateTestCaseRun(@PathVariable testCaseRunID: UUID, @RequestBody request: UpdateTestCaseRunDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.updateTestCaseRun(testCaseRunID, request)))
    }

    @GetMapping("/jira/configuration")
    fun retrieveJiraConfiguration(): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = jiraService.configuration()))
    }

    @AdminOnly
    @GetMapping("/jira/projects")
    fun retrieveJiraProjects(): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = jiraService.listProjects()))
    }

    @AdminOnly
    @GetMapping("/jira/projects/{projectKey}/issue-types")
    fun retrieveJiraIssueTypes(@PathVariable projectKey: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = jiraService.listIssueTypes(projectKey)))
    }

    @AdminOnly
    @GetMapping("/jira/projects/{projectKey}/reporter-permission")
    fun retrieveJiraReporterPermission(@PathVariable projectKey: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = JiraReporterPermissionDTO(projectKey, jiraService.canModifyReporter(projectKey))))
    }

    @GetMapping("/jira/issues")
    fun retrieveJiraIssues(@RequestParam("keys") issueKeys: List<String>): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.retrieveJiraIssues(issueKeys)))
    }

    @GetMapping("/test-case-runs/{testCaseRunID}/jira-issues/{issueKey}/transitions")
    fun retrieveJiraTransitions(@PathVariable testCaseRunID: UUID, @PathVariable issueKey: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.listJiraTransitions(testCaseRunID, issueKey)))
    }

    @GetMapping("/test-case-runs/{testCaseRunID}/jira-issues/{issueKey}/assignable-users")
    fun searchAssignableJiraUsers(@PathVariable testCaseRunID: UUID, @PathVariable issueKey: String, @RequestParam("query") query: String): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = workspaceService.searchAssignableJiraUsers(testCaseRunID, issueKey, query)))
    }

    @PostMapping("/test-case-runs/{testCaseRunID}/jira-issue")
    fun createJiraIssue(@PathVariable testCaseRunID: UUID, @RequestBody request: CreateJiraIssueDTO): ResponseEntity<Any> {
        val link = workspaceService.createJiraIssue(testCaseRunID, request)
        return ResponseEntity.ok(DataResponse(data = link))
    }

    @PostMapping("/test-cases/{testCaseID}/jira-links")
    fun linkJiraIssue(@PathVariable testCaseID: UUID, @RequestBody request: LinkJiraIssueDTO): ResponseEntity<Any> {
        val link = workspaceService.linkJiraIssue(testCaseID, request)
        return ResponseEntity.ok(DataResponse(data = link))
    }

    @DeleteMapping("/jira-links/{linkID}")
    fun deleteJiraLink(@PathVariable linkID: UUID): ResponseEntity<Any> {
        workspaceService.deleteJiraLink(linkID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PutMapping("/test-case-runs/{testCaseRunID}/details")
    fun updateTestCaseRunDetails(@PathVariable testCaseRunID: UUID, @RequestBody request: UpdateTestCaseRunDetailsDTO): ResponseEntity<Any> {
        workspaceService.updateTestCaseRunDetails(testCaseRunID, request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @AdminOnly
    @DeleteMapping("/test-case-runs/{testCaseRunID}")
    fun deleteTestCaseRun(@PathVariable testCaseRunID: UUID): ResponseEntity<Any> {
        workspaceService.deleteTestCaseRun(testCaseRunID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }
}