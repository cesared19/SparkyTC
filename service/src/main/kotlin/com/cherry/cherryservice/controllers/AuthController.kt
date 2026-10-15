package com.cherry.cherryservice.controllers

import com.cherry.cherryservice.auth.AdminOnly
import com.cherry.cherryservice.auth.CurrentUser
import com.cherry.cherryservice.dto.DataResponse
import com.cherry.cherryservice.dto.FetchResponseStatus
import com.cherry.cherryservice.dto.StatusResponse
import com.cherry.cherryservice.dto.auth.ChangePasswordDTO
import com.cherry.cherryservice.dto.auth.CreateUserDTO
import com.cherry.cherryservice.dto.auth.LoginDTO
import com.cherry.cherryservice.dto.auth.UpdateUserDTO
import com.cherry.cherryservice.interceptors.AuthenticationInterceptor
import com.cherry.cherryservice.services.AuthService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import java.util.UUID

@RestController
@RequestMapping("/api/v1")
class AuthController(
    private val authService: AuthService
) {

    @PostMapping("/auth/login")
    fun login(@RequestBody request: LoginDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = authService.login(request)))
    }

    @PostMapping("/auth/logout")
    fun logout(request: HttpServletRequest): ResponseEntity<Any> {
        AuthenticationInterceptor.bearerToken(request)?.let { authService.logout(it) }
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @GetMapping("/auth/me")
    fun currentUser(): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = currentUserOrThrow().toDTO()))
    }

    @PutMapping("/auth/password")
    fun changePassword(@RequestBody request: ChangePasswordDTO): ResponseEntity<Any> {
        authService.changePassword(currentUserOrThrow(), request)
        return ResponseEntity.ok(StatusResponse(FetchResponseStatus.SUCCESS))
    }

    @AdminOnly
    @GetMapping("/admin/users")
    fun retrieveUsers(): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = authService.retrieveUsers()))
    }

    @AdminOnly
    @PostMapping("/admin/users")
    fun createUser(@RequestBody request: CreateUserDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = authService.createUser(request)))
    }

    @AdminOnly
    @PutMapping("/admin/users/{userID}")
    fun updateUser(@PathVariable userID: UUID, @RequestBody request: UpdateUserDTO): ResponseEntity<Any> {
        return ResponseEntity.ok(DataResponse(data = authService.updateUser(currentUserOrThrow(), userID, request)))
    }

    private fun currentUserOrThrow() = requireNotNull(CurrentUser.get()) { "Not signed in" }
}
