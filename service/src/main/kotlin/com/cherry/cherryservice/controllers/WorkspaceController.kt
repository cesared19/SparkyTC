package com.cherry.cherryservice.controllers

import com.cherry.cherryservice.auth.AdminOnly
import com.cherry.cherryservice.dto.*
import com.cherry.cherryservice.dto.documents.TestRunExportType
import com.cherry.cherryservice.dto.jira.CreateJiraIssueDTO
import com.cherry.cherryservice.dto.jira.LinkJiraIssueDTO
import com.cherry.cherryservice.dto.projects.CreateWorkspaceProjectDTO
import com.cherry.cherryservice.dto.properties.CreatePropertyConfigurationDTO
import com.cherry.cherryservice.dto.properties.UpdatePropertyConfigurationDTO
import com.cherry.cherryservice.dto.testcases.BatchCreateTestCasesDTO
import com.cherry.cherryservice.dto.testcases.CreateTestCaseDTO
import com.cherry.cherryservice.dto.testruns.CreateTestRunDTO
import com.cherry.cherryservice.dto.testruns.UpdateTestCaseRunDTO
import com.cherry.cherryservice.dto.testruns.UpdateTestCaseRunDetailsDTO
import com.cherry.cherryservice.dto.testruns.UpdateTestRunDTO
import com.cherry.cherryservice.services.JiraService
import com.cherry.cherryservice.services.WorkspaceService
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
) {

    @GetMapping("/projects")
    fun retrieveProjects(): ResponseEntity<Any> {
        val projects = workspaceService.retrieveProjects()
        return ResponseEntity.ok(DataResponse(data = projects))
    }

    @PostMapping("/projects")
    fun createProject(@RequestBody request: CreateWorkspaceProjectDTO): ResponseEntity<Any> {
        workspaceService.createProject(request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
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

    @PostMapping("/test-runs/{projectShortCode}/{testRunNumber}/export", produces = [MediaType.APPLICATION_OCTET_STREAM_VALUE])
    fun generateDocx(@PathVariable projectShortCode: String, @PathVariable testRunNumber: Long, @RequestParam("type") exportType: TestRunExportType): ResponseEntity<ByteArray> {
        val documentDTO = workspaceService.exportTestRunAsDocx(projectShortCode, testRunNumber, exportType)

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, """attachment; filename="${documentDTO.fileName}"""")
            .contentType(MediaType("application", "vnd.openxmlformats-officedocument.wordprocessingml.document"))
            .body(documentDTO.data)
    }

    @GetMapping("/test-case-runs/{testCaseRunID}/next")
    fun retrieveNextTestCaseRun(@PathVariable testCaseRunID: UUID): ResponseEntity<Any> {
        val testCaseRun = workspaceService.retrieveNextTestCaseRun(testCaseRunID)
        return ResponseEntity.ok(DataResponse(data = testCaseRun))
    }

    @PutMapping("/test-case-runs/{testCaseRunID}")
    fun updateTestCaseRun(@PathVariable testCaseRunID: UUID, @RequestBody request: UpdateTestCaseRunDTO): ResponseEntity<Any> {
        workspaceService.updateTestCaseRun(testCaseRunID, request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/jira/configuration")
    fun retrieveJiraConfiguration(): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = jiraService.configuration()))
    }

    @GetMapping("/jira/issues")
    fun retrieveJiraIssues(@RequestParam("keys") issueKeys: List<String>): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = jiraService.retrieveIssues(issueKeys)))
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