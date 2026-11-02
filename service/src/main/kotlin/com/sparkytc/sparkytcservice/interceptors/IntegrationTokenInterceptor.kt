package com.sparkytc.sparkytcservice.interceptors

import com.sparkytc.sparkytcservice.auth.CurrentIntegrationProject
import com.sparkytc.sparkytcservice.dto.ErrorResponse
import com.sparkytc.sparkytcservice.services.ApiTokenService
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor

/** Requires a project API token on the integration API; the request can only read that project. */
@Component
class IntegrationTokenInterceptor(
    private val apiTokenService: ApiTokenService,
    private val objectMapper: ObjectMapper,
) : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val project = AuthenticationInterceptor.bearerToken(request)?.let { apiTokenService.authenticate(it) }
        if (project == null) {
            response.status = HttpStatus.UNAUTHORIZED.value()
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            objectMapper.writeValue(response.outputStream, ErrorResponse(error = "Unauthorized", message = "Send a valid project API token"))
            return false
        }
        CurrentIntegrationProject.set(project.id)
        return true
    }

    override fun afterCompletion(request: HttpServletRequest, response: HttpServletResponse, handler: Any, ex: Exception?) {
        CurrentIntegrationProject.clear()
    }
}
