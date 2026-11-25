package com.sparkytc.sparkytcservice.interceptors

import com.fasterxml.jackson.databind.ObjectMapper
import com.sparkytc.sparkytcservice.dto.ErrorResponse
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.servlet.HandlerInterceptor
import java.security.MessageDigest

/**
 * The /api/system endpoints are for the other apps of the suite (SparkStock) on the same server, not for project tokens: it needs
 * the shared STOCK_INTEGRATION_TOKEN, and is off while it's empty. The client service doesn't forward it, so it's only
 * reachable on the docker network.
 */
@Component
class SystemTokenInterceptor(
    @Value("\${sparkytc.stock.integration-token:}") private val token: String,
    private val objectMapper: ObjectMapper,
) : HandlerInterceptor {

    override fun preHandle(request: HttpServletRequest, response: HttpServletResponse, handler: Any): Boolean {
        if (token.isBlank()) {
            return reject(response, HttpStatus.SERVICE_UNAVAILABLE, "Unavailable", "The system API is off: set STOCK_INTEGRATION_TOKEN")
        }
        val given = AuthenticationInterceptor.bearerToken(request)
        if (given == null || !MessageDigest.isEqual(given.toByteArray(), token.toByteArray())) {
            return reject(response, HttpStatus.UNAUTHORIZED, "Unauthorized", "Send the suite's integration token")
        }
        return true
    }

    private fun reject(response: HttpServletResponse, status: HttpStatus, error: String, message: String): Boolean {
        response.status = status.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = "UTF-8"
        objectMapper.writeValue(response.outputStream, ErrorResponse(error = error, message = message))
        return false
    }
}
