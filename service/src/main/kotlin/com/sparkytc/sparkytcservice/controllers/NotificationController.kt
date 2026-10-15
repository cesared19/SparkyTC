package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.dto.FetchResponseStatus
import com.sparkytc.sparkytcservice.dto.StatusResponse
import com.sparkytc.sparkytcservice.services.NotificationService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1/notifications")
class NotificationController(
    private val notificationService: NotificationService
) {
    @GetMapping
    fun retrieveNotifications(): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = notificationService.retrieveNotifications(currentUser())))
    }

    @PutMapping("/{notificationID}/read")
    fun markRead(@PathVariable notificationID: UUID): ResponseEntity<Any> {
        notificationService.markRead(currentUser(), notificationID)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @PutMapping("/read-all")
    fun markAllRead(): ResponseEntity<Any> {
        notificationService.markAllRead(currentUser())
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    private fun currentUser() = requireNotNull(CurrentUser.get()) { "Not signed in" }
}
