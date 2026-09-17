export class Rules {
  constructor(options?: { string?: boolean });
  breaks(text: string): Iterable<{ position: number; required: boolean; string?: string }>;
}
