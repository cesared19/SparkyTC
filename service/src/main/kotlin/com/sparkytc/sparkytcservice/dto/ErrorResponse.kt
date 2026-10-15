package com.sparkytc.sparkytcservice.dto

data class ErrorResponse(
    val status: FetchResponseStatus = FetchResponseStatus.ERROR,
    val error: String,
    val message: String
)