/**
 * Simple in-memory request queue for Ollama queries
 * to ensure we process queries sequentially without overloading the remote host.
 * Supports progress/position callbacks.
 */
class OllamaQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

    /**
     * Enqueues an async task and returns a promise that resolves when the task finishes.
     * @param {Function} taskFn - The async function to execute.
     * @param {Function} onQueueUpdate - Callback function called with (position, isProcessing).
     */
    enqueue(taskFn, onQueueUpdate) {
        return new Promise((resolve, reject) => {
            const queueItem = { taskFn, resolve, reject, onQueueUpdate };
            this.queue.push(queueItem);
            
            // Notify caller of initial queue status
            if (onQueueUpdate) {
                const isFirst = this.queue.length === 1 && !this.processing;
                const position = isFirst ? 0 : this.queue.length;
                onQueueUpdate(position, isFirst);
            }
            
            this.processNext();
        });
    }

    async processNext() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const { taskFn, resolve, reject, onQueueUpdate } = this.queue.shift();

        // Notify that we are now processing (position 0, isProcessing = true)
        if (onQueueUpdate) {
            onQueueUpdate(0, true);
        }

        // Broadcast position updates to all other waiting items in the queue
        this.queue.forEach((item, index) => {
            if (item.onQueueUpdate) {
                item.onQueueUpdate(index + 1, false);
            }
        });

        try {
            const result = await taskFn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.processing = false;
            // Let the event loop breathe, then process the next task
            setTimeout(() => this.processNext(), 50);
        }
    }
}

export const ollamaQueue = new OllamaQueue();
