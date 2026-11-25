package com.sparkytc.sparkytcservice.dto.testruns

/** The device a result was recorded on (SparkStock asset tag and a copy of its details). */
data class ResultDeviceDTO(
    val ref: String,
    val name: String? = null,
    val model: String? = null,
    val version: String? = null,
)
