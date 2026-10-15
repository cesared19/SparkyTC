package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.AdminOnly
import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.dto.FetchResponseStatus
import com.sparkytc.sparkytcservice.dto.StatusResponse
import com.sparkytc.sparkytcservice.dto.auth.ChangePasswordDTO
import com.sparkytc.sparkytcservice.dto.auth.CreateUserDTO
import com.sparkytc.sparkytcservice.dto.auth.LoginDTO
import com.sparkytc.sparkytcservice.dto.auth.UpdateUserDTO
import com.sparkytc.sparkytcservice.interceptors.AuthenticationInterceptor
import com.sparkytc.sparkytcservice.services.AuthService
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
