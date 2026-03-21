type AsyncFn<T> = (...args: any[]) => Promise<T>;

enum BreakerState {
    CLOSED, // Normal operation
    OPEN,   // Failed state, blocking requests
    HALF_OPEN // Testing if service is back
}

export class CircuitBreaker {
    private state: BreakerState = BreakerState.CLOSED;
    private failureCount: number = 0;
    private lastFailureTime: number = 0;
    private readonly threshold: number = 5; // Failures before opening
    private readonly cooldown: number = 10000; // 10s cooldown

    constructor(private readonly name: string) {}

    async execute<T>(fn: AsyncFn<T>, fallback: T): Promise<T> {
        if (this.state === BreakerState.OPEN) {
            if (Date.now() - this.lastFailureTime > this.cooldown) {
                this.state = BreakerState.HALF_OPEN;
                console.warn(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN`);
            } else {
                console.error(`[CircuitBreaker:${this.name}] Circuit is OPEN. Falling back.`);
                return fallback;
            }
        }

        try {
            const result = await fn();
            this.success();
            return result;
        } catch (error) {
            this.failure();
            console.error(`[CircuitBreaker:${this.name}] Execution error:`, error);
            return fallback;
        }
    }

    private success() {
        this.failureCount = 0;
        this.state = BreakerState.CLOSED;
    }

    private failure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.failureCount >= this.threshold) {
            this.state = BreakerState.OPEN;
            console.error(`[CircuitBreaker:${this.name}] Circuit OPENED due to multiple failures.`);
        }
    }
}

// Named instances for critical subsystems
export const dbBreaker = new CircuitBreaker('DATABASE_WRITES');
export const wsBreaker = new CircuitBreaker('WEBSOCKET_BROADCASTS');
