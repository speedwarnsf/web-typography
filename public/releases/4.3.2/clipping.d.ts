interface Clip {
    left: number;
    top: number;
    bottom: number;
    topRadius: number;
    bottomRadius: number;
}
export interface HangingRoom {
    clips: Clip[];
    supported: boolean;
}
/** Conservative rectangular clipping geometry. Never change author overflow. */
export declare function hangingRoom(element: HTMLElement): HangingRoom;
export declare function fitsHangingRoom(room: HangingRoom, glyph: DOMRect, px: number, overhang?: number): boolean;
export {};
