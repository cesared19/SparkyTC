package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.dto.integration.IntegrationResultsRequestDTO
import com.sparkytc.sparkytcservice.services.IntegrationService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

/**
 * Read-only API for other apps, authenticated with a project API token (Authorization: Bearer stc_...).
 * Every endpoint reads the token's project.
 */
@RestController
@RequestMapping("/api/integration/v1")
class IntegrationController(private val integrationService: IntegrationService) {

    @GetMapping("/project")
    fun project(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = integrationService.retrieveProject()))

    @GetMapping("/sections")
    fun sections(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = integrationService.retrieveSections()))

    @GetMapping("/test-cases")
    fun testCases(@RequestParam(required = false) query: String?, @RequestParam(defaultValue = "50") limit: Int): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationService.retrieveTestCases(query, limit)))

    @GetMapping("/test-plans")
    fun testPlans(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = integrationService.retrieveTestPlans()))

    /** Latest results of the given test cases, sections and plans in a build (the current one by default). */
    @PostMapping("/results")
    fun results(@RequestBody request: IntegrationResultsRequestDTO): ResponseEntity<Any> =
        ResponseEntity.ok(DataResponse(data = integrationService.retrieveResults(request)))
}
