# Scheduling Workflow Flowchart

This diagram shows the end-to-end scheduling and delivery workflow, including queueing, retries, lock-based anti-ban behavior, reconciliation loops, and observability.

```mermaid
flowchart TD
    A[Client calls POST /schedules] --> B[SchedulesController validates images]
    B --> C[SchedulesService.create or update]

    C --> D{Cron valid and >= minimum interval?}
    D -- No --> D1[Reject request 400]
    D -- Yes --> E{All groupIds belong to tenant?}
    E -- No --> E1[Reject request 400]
    E -- Yes --> F[Persist schedule and ScheduleGroup links]

    F --> G[Compute nextRunAt]
    G --> H[Register repeat trigger in schedule-trigger queue]
    H --> I{runNow = true?}
    I -- Yes --> J[Enqueue immediate trigger job]
    I -- No --> K[Wait for repeat tick]
    J --> K

    K --> L[ScheduleTriggerProcessor.process]
    L --> M{Schedule active and cron still valid?}
    M -- No --> M1[Skip trigger]
    M -- Yes --> N[Generate runId]

    N --> O[Pre-create pending MessageLog for each group]
    O --> P[Build message-send jobs for all groups]
    P --> Q{sendQueue.addBulk succeeds?}

    Q -- Yes --> R[All send jobs queued]
    Q -- No --> S[Fallback: enqueue jobs one-by-one]
    S --> T{Any fallback enqueue failed?}
    T -- Yes --> U[Keep logs pending + errorReason enqueue_pending_retry]
    T -- No --> R
    U --> R

    R --> V[Update schedule nextRunAt]
    V --> W[message-send workers pick jobs]

    W --> X[MessageSendProcessor.process]
    X --> Y{Log already sent?}
    Y -- Yes --> Y1[Skip duplicate]
    Y -- No --> Z[Daily cap check in tenant timezone]

    Z --> ZA{Cap exceeded?}
    ZA -- Yes --> ZB[Mark pending daily_cap_wait + delayed requeue]
    ZA -- No --> ZC[Acquire per-tenant Redis lock]

    ZC --> ZD{Lock acquired before timeout?}
    ZD -- No --> ZE{Final attempt in-job?}
    ZE -- No --> ZF[Throw tenant_lock_busy for Bull retry]
    ZE -- Yes --> ZG[Mark pending tenant_lock_busy + delayed requeue]

    ZD -- Yes --> ZH{index > 0?}
    ZH -- Yes --> ZI[Apply anti-ban jitter delay]
    ZH -- No --> ZJ[Send immediately]
    ZI --> ZJ

    ZJ --> ZK[Send message via WhatsAppService]
    ZK --> ZL{Send succeeded?}
    ZL -- Yes --> ZM[Update log status sent + waMessageId]
    ZM --> ZN[Emit socket log:updated to tenant room]

    ZL -- No --> ZO{Final attempt in-job?}
    ZO -- No --> ZP[Throw send error for Bull retry]
    ZO -- Yes --> ZQ[Mark pending + compute exponential jitter retry delay + requeue]
    ZQ --> ZR[Emit socket pending retry info]

    ZF --> ZS[Job retried by BullMQ]
    ZP --> ZS
    ZS --> X

    ZN --> ZT[Release lock with token compare-and-delete]
    ZR --> ZT
    ZG --> ZT

    subgraph Startup Recovery
      SA[App boots]
      SB[SchedulesBootstrapService loads active schedules]
      SC[Call rehydrateRepeats for active schedules without repeat keys]
      SA --> SB --> SC --> H
    end

    subgraph Recovery Loops
      AA[PendingReconcileService every minute]
      AB[Find stale pending logs for active schedules]
      AC[Requeue send jobs best-effort and mark stale_pending_requeued]
      AA --> AB --> AC

      AD[RunCompletenessService every minute]
      AE[Scan recent runs]
      AF[Compare expected groups vs existing run logs]
      AG{Missing group logs?}
      AH[Create repaired pending logs run_completion_repair]
      AI[Enqueue repaired send jobs]
      AD --> AE --> AF --> AG
      AG -- Yes --> AH --> AI
      AG -- No --> AJ[No action]
    end

    AC --> X
    AI --> X

    subgraph Observability and Retention
      BA[GET /logs and GET /logs/stats]
      BB[Expose sent failed pending stalePending longPending pendingAwaitingEnqueue]
      BC[LogsCleanupService daily 3AM]
      BD[Delete old sent/failed sooner]
      BE[Delete old pending later to preserve recovery window]
      BA --> BB
      BC --> BD
      BC --> BE
    end
```
