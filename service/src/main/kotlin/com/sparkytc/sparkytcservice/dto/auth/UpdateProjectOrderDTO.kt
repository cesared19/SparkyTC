package com.sparkytc.sparkytcservice.dto.auth

data class UpdateProjectOrderDTO(
    // the projects in the order the user wants them; an empty list goes back to title order
    val projectShortCodes: List<String>
)
