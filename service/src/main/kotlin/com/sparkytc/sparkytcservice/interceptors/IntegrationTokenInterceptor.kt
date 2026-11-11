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

/**
 * Requires a project API token on the integration API; the request works only on that project, and creating
 * needs a token that can write.
 */
@Component
class IntegrationTokenInterceptor(
    private val apiTokenService: ApiTokenService,
    private val objectMapper: ObjectMapper,
) : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        val token = AuthenticationInterceptor.bearerToken(request)?.let { apiTokenService.authenticate(it) }
        if (token == null) {
            response.status = HttpStatus.UNAUTHORIZED.value()
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.characterEncoding = "UTF-8"
            objectMapper.writeValue(response.outputStream, ErrorResponse(error = "Unauthorized", message = "Send a valid project API token"))
            return false
        }
        // read only tokens can't create anything
        if (request.method != "GET" && !isRead(request) && !token.canWrite) {
            response.status = HttpStatus.FORBIDDEN.value()
            response.contentType = MediaType.APPLICATION_JSON_VALUE
            response.characterEncoding = "UTF-8"
            objectMapper.writeValue(response.outputStream, ErrorResponse(error = "Forbidden", message = READ_ONLY_MESSAGE))
            return false
        }
        CurrentIntegrationProject.set(CurrentIntegrationProject.Token(token.id, token.project.id, token.canWrite))
        return true
    }

    // POST /results reads: it takes its filters in the body. Only that endpoint; recording results writes.
    private fun isRead(request: HttpServletRequest) =
        request.requestURI.removePrefix(request.contextPath).removeSuffix("/") == "/api/integration/v1/results"

    override fun afterCompletion(request: HttpServletRequest, response: HttpServletResponse, handler: Any, ex: Exception?) {
        CurrentIntegrationProject.clear()
    }
}

const val READ_ONLY_MESSAGE = "This token can only read. Create a Read and write token in Settings → API tokens."
