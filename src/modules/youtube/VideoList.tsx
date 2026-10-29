import { Row } from "../../ui/kit";
import { thumbUrl } from "./panelLogic";

export interface Item {
  videoId: string;
  channelId: string | null;
  title: string;
  meta: string; // "Channel · 3d" etc.
  dim?: boolean;
}

export function VideoList({ items, onPlay }: { items: Item[]; onPlay: (i: Item) => void }) {
  return (
    <div className="ui-list">
      {items.map((i) => (
        <Row key={i.videoId} className={i.dim ? "yt-dim" : ""}>
          <button type="button" className="yt-item" title={i.title} onClick={() => onPlay(i)}>
            <img className="yt-thumb" src={thumbUrl(i.videoId)} alt="" loading="lazy" />
            <span className="yt-text">
              <span className="yt-title">{i.title}</span>
              <span className="ui-meta">{i.meta}</span>
            </span>
          </button>
        </Row>
      ))}
    </div>
  );
}
