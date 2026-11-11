/**
 * @license
 * Adapter derived from Marionette's MIT-licensed lit-html adapter.
 * Copyright (c) 2020 Paul Falgout
 * See THIRD_PARTY_NOTICES.md for its complete license and provenance.
 */
// Shared preparation initializes once, even when the root is also imported.
import './template.js';
export {default, HtmlDomApi, setContents, notifyAttach, notifyDetach} from './marionette-core.js';
