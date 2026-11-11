package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.dto.integration.IntegrationCreateSectionDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationCreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationCreateTestPlanDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationCreateTestRunDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationRecordResultDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationResultsRequestDTO
import com.sparkytc.sparkytcservice.services.IntegrationService
import com.sparkytc.sparkytcservice.services.IntegrationWriteService
import com.sparkytc.sparkytcservice.dto.ErrorResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.web.multipart.MultipartFile
import java.util.UUID
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

/**
 * API for other apps, authenticated with a project API token (Authorization: Bearer stc_...). Every endpoint
 * works on the token's project; creating needs a Read and write token, and nothing is edited or deleted.
 */
@RestController
@RequestMapping("/api/integration/v1")
class IntegrationController(
    private val integrationService: IntegrationService,
    private val integrationWriteService: IntegrationWriteService,
) {

    @GetMapping("/project")
    fun project(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = integrationService.retrieveProject()))

    @GetMapping("/sections")
    fun sections(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = integrationService.retrieveSections()))

    @GetMapping("/test-cases")
    fun testCases(@RequestParam(required = false) query: String?, @RequestParam(defaultValue = "50") limit: Int): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationService.retrieveTestCases(query, limit)))

    /** A test case by its number, with its steps and results, newest first (up to `limit`). 404 if there's none. */
    @GetMapping("/test-cases/{testCaseNumber}/history")
    fun history(@PathVariable testCaseNumber: Long, @RequestParam(defaultValue = "50") limit: Int): ResponseEntity<Any> {
        val history = integrationService.retrieveHistory(testCaseNumber, limit)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse(error = "Not Found", message = "No test case $testCaseNumber in this project"))
        return ResponseEntity.ok(DataResponse(data = history))
    }

    @GetMapping("/test-plans")
    fun testPlans(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = integrationService.retrieveTestPlans()))

    /** Creates the sections of a path that don't exist yet, e.g. "Checkout / Payments", and returns the last one. */
    @PostMapping("/sections")
    fun createSection(@RequestBody request: IntegrationCreateSectionDTO): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationWriteService.createSection(request)))

    /** Creates a test case, or returns the one with the same sourceRef (`created` tells which). */
    @PostMapping("/test-cases")
    fun createTestCase(@RequestBody request: IntegrationCreateTestCaseDTO): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationWriteService.createTestCase(request)))

    /** Creates a test plan, or returns the one with the same sourceRef (`created` tells which). */
    @PostMapping("/test-plans")
    fun createTestPlan(@RequestBody request: IntegrationCreateTestPlanDTO): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationWriteService.createTestPlan(request)))

    /**
     * Creates an automated test run for a registered build, with test cases by number and/or a test plan's, or
     * returns the one with the same sourceRef (`created` tells which).
     */
    @PostMapping("/test-runs")
    fun createTestRun(@RequestBody request: IntegrationCreateTestRunDTO): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationWriteService.createTestRun(request)))

    /**
     * Records a result for a test case of an automated test run, with its notes, time and report. 404 when the
     * project has no test run with that number.
     */
    @PostMapping("/test-runs/{testRunNumber}/results")
    fun recordResult(@PathVariable testRunNumber: Long, @RequestBody request: IntegrationRecordResultDTO): ResponseEntity<Any> {
        val recorded = integrationWriteService.recordResult(testRunNumber, request)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse(error = "Not Found", message = "No test run $testRunNumber in this project"))
        return ResponseEntity.ok(DataResponse(data = recorded))
    }

    /**
     * Attaches files to a result of an automated test run (multipart, field "files"): images, videos and .zip files,
     * which are only ever downloaded. 404 when the run or the result isn't in this project.
     */
    @PostMapping("/test-runs/{testRunNumber}/results/{resultID}/attachments", consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun uploadEvidence(
        @PathVariable testRunNumber: Long,
        @PathVariable resultID: UUID,
        @RequestParam("files", required = false) files: List<MultipartFile>?,
    ): ResponseEntity<Any> {
        val stored = integrationWriteService.uploadEvidence(testRunNumber, resultID, files.orEmpty())
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse(error = "Not Found", message = "No result $resultID in test run $testRunNumber of this project"))
        return ResponseEntity.ok(DataResponse(data = stored))
    }

    /** Latest results of the given test cases, sections and plans in a build (the current one by default). */
    @PostMapping("/results")
    fun results(@RequestBody request: IntegrationResultsRequestDTO): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationService.retrieveResults(request)))
}
