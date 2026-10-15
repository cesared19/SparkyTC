package com.sparkytc.sparkytcservice.dto

data class DataResponse<T>(
    val status: FetchResponseStatus = FetchResponseStatus.SUCCESS,
    val data: T
)