package com.sparkytc.sparkytcservice.controllers

import com.sparkytc.sparkytcservice.auth.CurrentUser
import com.sparkytc.sparkytcservice.dto.DataResponse
import com.sparkytc.sparkytcservice.services.StockService
import com.sparkytc.sparkytcservice.services.StockUnavailableException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

/** SparkStock's devices, to choose the one a result was recorded on. */
@RestController
@RequestMapping("/api/v1/workspace/stock")
class StockController(private val stockService: StockService) {

    @GetMapping("/configuration")
    fun configuration(): ResponseEntity<Any> = ResponseEntity.ok(DataResponse(data = stockService.configuration()))

    /** `mine=true` lists the devices the signed-in user has on loan or assigned; `q` searches every device. */
    @GetMapping("/devices")
    fun devices(@RequestParam(defaultValue = "false") mine: Boolean, @RequestParam(required = false) q: String?): ResponseEntity<Any> {
        val holder = if (mine) CurrentUser.get()?.externalID else null
        return try {
            ResponseEntity.ok(DataResponse(data = stockService.listDevices(holder, q)))
        } catch (ex: StockUnavailableException) {
            ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(
                com.sparkytc.sparkytcservice.dto.ErrorResponse(error = "SparkStock unavailable", message = ex.message ?: "SparkStock can't be reached")
            )
        }
    }
}
