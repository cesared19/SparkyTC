package com.sparkytc.sparkytcservice.services

import com.sparkytc.sparkytcservice.dto.testruns.TestCaseRunStatus
import com.sparkytc.sparkytcservice.models.TestCaseResult
import com.sparkytc.sparkytcservice.repositories.ProjectBuildRepository
import com.sparkytc.sparkytcservice.repositories.TestRunRepository
import com.sparkytc.sparkytcservice.repositories.WorkspaceProjectRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.Date

data class SystemProjectDTO(
    val projectShortCode: String,
    val title: String,
    val deviceMode: String,
    // newest first; the first one is the current build
    val builds: List<String>,
)

data class DeviceResultCountsDTO(
    val ref: String,
    val name: String?,
    val model: String?,
    val version: String?,
    // test cases whose latest result on this device (and version) in the build has each status
    val passed: Int,
    val failed: Int,
    val blocked: Int,
    val skipped: Int,
    val testCases: Int,
    val lastRecordedAt: Date,
)

data class BuildDeviceResultsDTO(
    val projectShortCode: String,
    val build: String,
    val devices: List<DeviceResultCountsDTO>,
)

/**
 * What the other apps of the suite read about projects and devices (SparkStock's coverage matrix): the projects with
 * their builds, and for a build, how the test cases went on each device. Results without a device are left out.
 */
@Service
class DeviceResultsService(
    private val projectRepository: WorkspaceProjectRepository,
    private val projectBuildRepository: ProjectBuildRepository,
    private val testRunRepository: TestRunRepository,
    private val buildResultsService: BuildResultsService,
) {
    @Transactional(readOnly = true)
    fun projects(): List<SystemProjectDTO> =
        projectRepository.findAll().sortedBy { it.title.lowercase() }.map { project ->
            SystemProjectDTO(
                projectShortCode = project.projectShortCode,
                title = project.title,
                deviceMode = project.deviceMode.name,
                builds = projectBuildRepository.findAllByProjectOrderByIdDesc(project).map { it.buildNumber },
            )
        }

    /**
     * For each device and version results were recorded on in the build's test runs (the current build by default),
     * the latest result of each test case on it. Null when the project doesn't exist or has no such build.
     */
    @Transactional(readOnly = true)
    fun deviceResults(projectShortCode: String, buildNumber: String?): BuildDeviceResultsDTO? {
        val project = projectRepository.findByProjectShortCode(projectShortCode.uppercase()) ?: return null
        val build = buildNumber?.trim()?.takeIf { it.isNotEmpty() }
            ?.let { projectBuildRepository.findByProjectAndBuildNumberIgnoreCase(project, it) }
            ?: if (buildNumber.isNullOrBlank()) projectBuildRepository.findTopByProjectOrderByIdDesc(project) else null
        build ?: return null

        val testRuns = testRunRepository.findAllByProject(project).filter { it.build?.id == build.id }
        val results = buildResultsService.testCaseRunsByRun(testRuns).values.flatten()
            .filter { !it.testCase.isArchived }
            .flatMap { it.results }
            .filter { it.device != null && it.status != TestCaseRunStatus.PENDING }

        // the latest result of each test case on each device and version
        val latest = results
            .groupBy { Triple(it.testCaseRun.testCase.id, it.device!!.ref.uppercase(), it.device!!.version) }
            .values.map { group -> group.maxWith(compareBy<TestCaseResult>({ it.recordedAt }, { it.id })) }

        val devices = latest.groupBy { it.device!!.ref.uppercase() to it.device!!.version }.map { (_, group) ->
            val newest = group.maxBy { it.recordedAt }
            val device = newest.device!!
            DeviceResultCountsDTO(
                ref = device.ref,
                name = device.name,
                model = device.model,
                version = device.version,
                passed = group.count { it.status == TestCaseRunStatus.PASS },
                failed = group.count { it.status == TestCaseRunStatus.FAIL },
                blocked = group.count { it.status == TestCaseRunStatus.BLOCKED },
                skipped = group.count { it.status == TestCaseRunStatus.SKIP },
                testCases = group.size,
                lastRecordedAt = newest.recordedAt,
            )
        }.sortedWith(compareBy({ it.model?.lowercase() }, { it.version }, { it.ref }))

        return BuildDeviceResultsDTO(project.projectShortCode, build.buildNumber, devices)
    }
}
