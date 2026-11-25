package com.sparkytc.sparkytcservice.services

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.databind.ObjectMapper
import com.sparkytc.sparkytcservice.dto.projects.DeviceMode
import com.sparkytc.sparkytcservice.models.ResultDevice
import com.sparkytc.sparkytcservice.models.WorkspaceProject
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException
import org.springframework.web.util.UriUtils
import java.net.http.HttpClient
import java.time.Duration
import java.util.UUID

/** A device as SparkStock's integration API describes it. */
@JsonIgnoreProperties(ignoreUnknown = true)
data class StockDeviceDTO(
    val ref: String,
    val name: String? = null,
    val manufacturer: String? = null,
    val model: String? = null,
    val type: String? = null,
    val usage: String? = null,
    val version: String? = null,
    val status: String? = null,
    val holderUserID: UUID? = null,
    val holderName: String? = null,
) {
    fun toResultDevice() = ResultDevice(ref = ref, name = name, model = model, version = version)
}

data class StockConfigurationDTO(
    @get:com.fasterxml.jackson.annotation.JsonProperty("isEnabled")
    val isEnabled: Boolean,
)

/** SparkStock couldn't be reached or answered with an error. */
class StockUnavailableException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)

/**
 * Reads devices from SparkStock (the suite's device stock) with the shared STOCK_INTEGRATION_TOKEN, to record which
 * device a result ran on. Off while STOCK_API_URL or the token are empty.
 */
@Service
class StockService(
    @Value("\${sparkytc.stock.api-url:}") apiURL: String,
    @Value("\${sparkytc.stock.integration-token:}") private val token: String,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val baseURL = apiURL.trim().trimEnd('/')

    val isEnabled: Boolean get() = baseURL.isNotEmpty() && token.isNotBlank()

    private val client: RestClient by lazy {
        RestClient.builder()
            .baseUrl(baseURL)
            .requestFactory(JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()).apply {
                setReadTimeout(Duration.ofSeconds(5))
            })
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .build()
    }

    fun configuration() = StockConfigurationDTO(isEnabled)

    /** Devices that aren't retired; `holderUserID` (a SparkyTC user's external ID) keeps that person's. */
    fun listDevices(holderUserID: UUID? = null, query: String? = null): List<StockDeviceDTO> {
        requireEnabled()
        return call {
            client.get().uri { builder ->
                builder.path("/api/integration/v1/devices")
                holderUserID?.let { builder.queryParam("holderUserID", it) }
                query?.trim()?.takeIf { it.isNotEmpty() }?.let { builder.queryParam("q", it) }
                builder.build()
            }.retrieve().body(String::class.java)
        }?.let { body -> objectMapper.readValue(body, DeviceList::class.java).data } ?: emptyList()
    }

    /** One device by asset tag, null when SparkStock has none with it. */
    fun findDevice(ref: String): StockDeviceDTO? {
        requireEnabled()
        return try {
            val body = client.get().uri("/api/integration/v1/devices/" + UriUtils.encodePathSegment(ref.trim(), Charsets.UTF_8))
                .retrieve().body(String::class.java)
            body?.let { objectMapper.readValue(it, OneDevice::class.java).data }
        } catch (ex: RestClientResponseException) {
            if (ex.statusCode == HttpStatus.NOT_FOUND) null else throw unavailable(ex)
        } catch (ex: RestClientException) {
            throw unavailable(ex)
        }
    }

    /**
     * The device to store with a result recorded in the app, following the project's device mode: none when it's
     * off, an error when it's required and missing or SparkStock doesn't know it. When SparkStock can't be reached,
     * the asset tag the tester typed is kept as is.
     */
    fun resultDevice(project: WorkspaceProject, ref: String?): ResultDevice? {
        if (project.deviceMode == DeviceMode.OFF) return null
        val tag = ref?.trim()?.takeIf { it.isNotEmpty() }
        if (tag == null) {
            require(project.deviceMode != DeviceMode.REQUIRED) { "Choose the device you tested on" }
            return null
        }
        require(tag.length <= 100) { "The device's asset tag is too long" }
        if (!isEnabled) return ResultDevice(ref = tag)
        return try {
            val device = findDevice(tag)
            requireNotNull(device) { "SparkStock has no device with the tag $tag" }
            device.toResultDevice()
        } catch (ex: StockUnavailableException) {
            log.warn("SparkStock unavailable, keeping the device tag {} without details: {}", tag, ex.message)
            ResultDevice(ref = tag.uppercase())
        }
    }

    /** The device sent with a result through the integration API: it must exist in SparkStock. */
    fun integrationDevice(ref: String?): ResultDevice? {
        val tag = ref?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        require(isEnabled) { "SparkStock isn't configured on this SparkyTC server, deviceRef can't be used" }
        val device = try {
            findDevice(tag)
        } catch (ex: StockUnavailableException) {
            throw IllegalArgumentException("SparkStock can't be reached to check the device $tag, try again later")
        }
        requireNotNull(device) { "SparkStock has no device with the tag $tag" }
        return device.toResultDevice()
    }

    private fun requireEnabled() {
        if (!isEnabled) throw StockUnavailableException("SparkStock isn't configured: set STOCK_API_URL and STOCK_INTEGRATION_TOKEN")
    }

    private fun <T> call(request: () -> T): T {
        try {
            return request()
        } catch (ex: RestClientException) {
            // includes error answers, e.g. a wrong token or SparkStock restarting
            throw unavailable(ex)
        }
    }

    private fun unavailable(ex: Exception) = StockUnavailableException("SparkStock can't be reached (${ex.message})", ex)

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class DeviceList(val data: List<StockDeviceDTO> = emptyList())

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class OneDevice(val data: StockDeviceDTO? = null)
}
