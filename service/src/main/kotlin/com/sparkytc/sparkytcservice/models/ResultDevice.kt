package com.sparkytc.sparkytcservice.models

import com.sparkytc.sparkytcservice.dto.testruns.ResultDeviceDTO
import jakarta.persistence.Column
import jakarta.persistence.Embeddable

/**
 * The device a result was recorded on: its SparkStock asset tag and a copy of its name, model and version at that
 * moment, so the result still reads the same if the device changes later in SparkStock.
 */
@Embeddable
class ResultDevice(
    @Column(name = "device_ref")
    val ref: String,

    @Column(name = "device_name")
    val name: String? = null,

    @Column(name = "device_model")
    val model: String? = null,

    @Column(name = "device_version")
    val version: String? = null,
) {
    fun toDTO() = ResultDeviceDTO(ref, name, model, version)

    /** e.g. "VR Headset 1 (VR-0001), Focus 3, version SKQ1.230810.001". */
    val description: String
        get() = buildString {
            append(if (name != null && name != ref) "$name ($ref)" else ref)
            model?.takeIf { it != name }?.let { append(", $it") }
            version?.let { append(", version $it") }
        }
}
