package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.dto.integration.IntegrationCreateSectionDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationCreateTestCaseDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationCreateTestPlanDTO
import com.sparkytc.sparkytcservice.dto.integration.IntegrationResultsRequestDTO
import com.sparkytc.sparkytcservice.services.IntegrationService
import com.sparkytc.sparkytcservice.services.IntegrationWriteService
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

    /** Latest results of the given test cases, sections and plans in a build (the current one by default). */
    @PostMapping("/results")
    fun results(@RequestBody request: IntegrationResultsRequestDTO): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationService.retrieveResults(request)))
}
