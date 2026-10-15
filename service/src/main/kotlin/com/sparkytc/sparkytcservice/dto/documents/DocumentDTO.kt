package com.sparkytc.sparkytcservice.dto.documents

data class DocumentDTO<T> (
    val fileName: String,
    val data: T
)