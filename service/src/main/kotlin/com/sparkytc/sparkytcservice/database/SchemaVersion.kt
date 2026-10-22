package com.sparkytc.sparkytcservice.database

enum class SchemaVersion(val value: String) {
    VERSION_ZERO("0.0.0"),
    VERSION_0_0_1("0.0.1"),
    VERSION_0_0_2("0.0.2"),
    VERSION_0_0_3("0.0.3"),
    VERSION_0_0_4("0.0.4"),
    VERSION_0_0_5("0.0.5"),
    VERSION_0_0_6("0.0.6"),
    VERSION_0_0_7("0.0.7"),
    VERSION_0_0_8("0.0.8"),
    VERSION_0_0_9("0.0.9"),
    VERSION_0_0_10("0.0.10"),
    VERSION_0_0_11("0.0.11"),
    VERSION_0_0_12("0.0.12"),
    VERSION_0_0_13("0.0.13"),
    VERSION_0_0_14("0.0.14"),
    VERSION_0_0_15("0.0.15");

    companion object {
        fun fromValue(value: String): SchemaVersion {
            return entries.firstOrNull { it.value == value.lowercase() }
                ?: throw IllegalArgumentException("Unknown field type: $value")
        }

        val currentVersion: SchemaVersion = VERSION_0_0_15
    }
}