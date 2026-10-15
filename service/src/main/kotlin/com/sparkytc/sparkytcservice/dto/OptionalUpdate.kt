package com.sparkytc.sparkytcservice.dto

data class OptionalUpdate<T> (
    val shouldSet: Boolean,
    val value: T?
)