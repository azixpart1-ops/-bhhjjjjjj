import { DialogComponent, DialogCloseEvent } from '@theme/dialog';

/**
 * Video in a modal dialog, built on Horizon's DialogComponent: Escape, backdrop
 * click, scroll lock and focus return to the trigger come from the native <dialog> + dialog.js.
 *
 * Opening plays the video with sound and controls. Closing pauses it and rewinds it to 0; an
 * external (YouTube/Vimeo) iframe is created from its <template> on open and removed on close, so
 * nothing loads or plays in the background.
 *
 * Markup contract (snippets/yv-video-modal.liquid):
 * <yv-video-modal-component>
 *   <button type="button" on:click="/showDialog" aria-haspopup="dialog">…</button>
 *   <dialog ref="dialog" class="yv-video-modal__dialog dialog-modal" scroll-lock>
 *     <button type="button" on:click="/closeDialog">×</button>
 *     <div ref="frame"> <video …> | <template ref="embed"><iframe …></iframe></template> </div>
 *   </dialog>
 * </yv-video-modal-component>
 *
 * @typedef {object} Refs
 * @property {HTMLDialogElement} dialog
 * @property {HTMLElement} [frame]
 * @property {HTMLTemplateElement} [embed]
 */
export class YvVideoModalComponent extends DialogComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener(DialogCloseEvent.eventName, this.#handleClose);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(DialogCloseEvent.eventName, this.#handleClose);
    this.#stop();
  }

  showDialog() {
    super.showDialog();
    // DialogComponent opens on the next frame; start playback right after it.
    requestAnimationFrame(() => requestAnimationFrame(() => this.#play()));
  }

  get #frame() {
    const frame = this.refs.frame;
    return frame instanceof HTMLElement ? frame : this.refs.dialog;
  }

  #play() {
    const frame = this.#frame;
    const template = this.refs.embed;

    if (template instanceof HTMLTemplateElement && !frame.querySelector('iframe')) {
      frame.append(template.content.cloneNode(true));
    }

    const video = frame.querySelector('video');
    if (video instanceof HTMLVideoElement) {
      video.muted = false;
      video.controls = true;
      video.play()?.catch(() => {
        // Autoplay with sound can be refused; the visible controls let the shopper start it.
      });
    }
  }

  #stop() {
    const frame = this.#frame;
    if (!frame) return;

    const video = frame.querySelector('video');
    if (video instanceof HTMLVideoElement) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // Ignore: the media may not be seekable yet.
      }
    }

    if (this.refs.embed instanceof HTMLTemplateElement) {
      frame.querySelectorAll('iframe').forEach((iframe) => iframe.remove());
    }
  }

  #handleClose = () => {
    this.#stop();
  };
}

if (!customElements.get('yv-video-modal-component')) {
  customElements.define('yv-video-modal-component', YvVideoModalComponent);
}
