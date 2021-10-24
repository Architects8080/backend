import { Heap } from './heap';

export class PriorityQueue<T> extends Heap<T> {
  enqueue(value: T) {
    this.push(value);
  }

  dequeue() {
    this.pop();
  }

  isEmpty() {
    return this.heap.length <= 0;
  }
}
