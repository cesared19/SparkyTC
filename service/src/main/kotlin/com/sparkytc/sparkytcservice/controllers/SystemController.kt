package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.dto.ErrorResponse
import com.sparkytc.sparkytcservice.dto.notifications.ExternalNotificationDTO
import com.sparkytc.sparkytcservice.services.DeviceResultsService
import com.sparkytc.sparkytcservice.services.NotificationService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

/** For the other apps of the suite (SparkStock), with the shared integration token; see SystemTokenInterceptor. */
@RestController
@RequestMapping("/api/system/v1")
class SystemController(
    private val notificationService: NotificationService,
    private val deviceResultsService: DeviceResultsService,
) {

    /** A notification in a user's bell, e.g. a reminder to return a device. */
    @PostMapping("/notifications")
    fun notify(@RequestBody request: ExternalNotificationDTO): ResponseEntity<Any> {
        val result = notificationService.notifyExternal(request)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse(error = "Not Found", message = "No SparkyTC user has the id ${request.userID}"))
        return ResponseEntity.ok(DataResponse(data = result))
    }

    /** Every project with its builds (newest first), e.g. to set SparkStock's coverage targets per project. */
    @GetMapping("/projects")
    fun projects(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = deviceResultsService.projects()))

    /** How the test cases went on each device in a build (the current one by default). */
    @GetMapping("/projects/{projectShortCode}/device-results")
    fun deviceResults(@PathVariable projectShortCode: String, @RequestParam(required = false) build: String?): ResponseEntity<Any> {
        val results = deviceResultsService.deviceResults(projectShortCode, build)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse(
                error = "Not Found", message = "No project $projectShortCode, or it has no build ${build ?: "yet"}",
            ))
        return ResponseEntity.ok(DataResponse(data = results))
    }
}
