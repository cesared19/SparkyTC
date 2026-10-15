package com.cherry.cherryservice.interceptors

import com.cherry.cherryservice.auth.AdminOnly
import com.cherry.cherryservice.auth.CurrentUser
import com.cherry.cherryservice.dto.ErrorResponse
import com.cherry.cherryservice.dto.auth.UserRole
import com.cherry.cherryservice.services.AuthService
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.method.HandlerMethod
import org.springframework.web.servlet.HandlerInterceptor

/** Requires a valid session token on every API request, and the ADMIN role on @AdminOnly endpoints. */
@Component
class AuthenticationInterceptor(
    private val authService: AuthService,
    private val objectMapper: ObjectMapper,
) : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val token = bearerToken(request)
        val user = token?.let { authService.authenticate(it) }
        if (user == null) {
            writeError(response, HttpStatus.UNAUTHORIZED, "Unauthorized", "Your session has expired, sign in again")
            return false
        }

        val requiresAdmin = handler is HandlerMethod && handler.hasMethodAnnotation(AdminOnly::class.java)
        if (requiresAdmin && user.role != UserRole.ADMIN) {
            writeError(response, HttpStatus.FORBIDDEN, "Forbidden", "Only admins can perform this action")
            return false
        }

        CurrentUser.set(user)
        return true
    }

    override fun afterCompletion(request: HttpServletRequest, response: HttpServletResponse, handler: Any, ex: Exception?) {
        CurrentUser.clear()
    }

    private fun writeError(response: HttpServletResponse, status: HttpStatus, error: String, message: String) {
        response.status = status.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        objectMapper.writeValue(response.outputStream, ErrorResponse(error = error, message = message))
    }

    companion object {
        fun bearerToken(request: HttpServletRequest): String? {
            val header = request.getHeader(HttpHeaders.AUTHORIZATION) ?: return null
            if (!header.startsWith("Bearer ", ignoreCase = true)) return null
            return header.substring(7).trim().takeIf { it.isNotEmpty() }
        }
    }
}
