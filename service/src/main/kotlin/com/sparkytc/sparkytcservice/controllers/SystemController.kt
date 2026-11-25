package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.dto.ErrorResponse
import com.sparkytc.sparkytcservice.dto.notifications.ExternalNotificationDTO
import com.sparkytc.sparkytcservice.services.NotificationService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

/** For the other apps of the suite (SparkStock), with the shared integration token; see SystemTokenInterceptor. */
@RestController
@RequestMapping("/api/system/v1")
class SystemController(private val notificationService: NotificationService) {

    /** A notification in a user's bell, e.g. a reminder to return a device. */
    @PostMapping("/notifications")
    fun notify(@RequestBody request: ExternalNotificationDTO): ResponseEntity<Any> {
        val result = notificationService.notifyExternal(request)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse(error = "Not Found", message = "No SparkyTC user has the id ${request.userID}"))
        return ResponseEntity.ok(DataResponse(data = result))
    }
}
