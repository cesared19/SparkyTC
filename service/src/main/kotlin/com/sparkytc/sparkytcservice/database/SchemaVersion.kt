package com.sparkytc.sparkytcservice.database

enum class SchemaVersion(val value: String) {
    VERSION_ZERO("0.0.0"),
    VERSION_0_0_1("0.0.1"),
    VERSION_0_0_2("0.0.2"),
    VERSION_0_0_3("0.0.3"),
    VERSION_0_0_4("0.0.4"),
    VERSION_0_0_5("0.0.5"),
    VERSION_0_0_6("0.0.6");

    companion object {
        fun fromValue(value: String): SchemaVersion {
            return entries.firstOrNull { it.value == value.lowercase() }
                ?: throw IllegalArgumentException("Unknown field type: $value")
        }

        val currentVersion: SchemaVersion = VERSION_0_0_6
    }
}