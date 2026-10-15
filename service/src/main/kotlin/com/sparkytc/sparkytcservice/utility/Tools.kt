package com.sparkytc.sparkytcservice.utility

class Tools {
    companion object {
        fun sanitize(input: String?): String? {
            if (input.isNullOrBlank()) {
                return null
            }
            return input
        }
    }
}