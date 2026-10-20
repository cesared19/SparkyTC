package com.sparkytc.sparkytcservice.models

import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.util.*

/**
 * A stretch of time a user spent testing a test case: from starting or resuming its timer until pausing it
 * or recording the result, or a duration typed in when the timer wasn't used. A running timer has no end yet.
 */
@Entity(name = "time_entries")
class TimeEntry(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0,

    @Column(name = "external_id")
    val externalID: UUID = UUID.randomUUID(),

    @Column(name = "creation_date")
    @CreationTimestamp
    val creationDate: Date = Date(),

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_run_id")
    val testCaseRun: TestCaseRun,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    val user: User?,

    @Column(name = "started_at", nullable = false)
    val startedAt: Date,

    @Column(name = "ended_at")
    var endedAt: Date? = null,

    @Column(name = "is_manual", nullable = false)
    val isManual: Boolean = false,
) {
    val isRunning: Boolean
        get() = endedAt == null

    /** Seconds spent, counting a running timer up to now. */
    fun seconds(now: Date = Date()): Long = ((endedAt ?: now).time - startedAt.time).coerceAtLeast(0) / 1000
}
