package com.sparkytc.sparkytcservice.models

import jakarta.persistence.*

// binary content is stored separately from the attachment metadata so listing attachments never loads file data
@Entity(name = "test_case_attachment_contents")
class TestCaseAttachmentContent(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attachment_id")
    val attachment: TestCaseAttachment,

    @Column(name = "data", nullable = false)
    val data: ByteArray,
)
