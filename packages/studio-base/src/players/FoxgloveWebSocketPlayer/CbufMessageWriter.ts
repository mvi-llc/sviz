// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Cbuf, {
  CbufMessage,
  CbufMessageMap,
  CbufHashMap,
  CbufMessageDefinition,
  CbufValue,
} from "wasm-cbuf";

import { MessageWriter } from "./MessageWriter";

function nowSeconds(): number {
  return Date.now() / 1000;
}

export class CbufMessageWriter implements MessageWriter {
  #schemaMap: CbufMessageMap;
  #hashMap: CbufHashMap;
  #msgdef: CbufMessageDefinition;

  public constructor(schemaText: string, messageType: string) {
    const res = Cbuf.parseCBufSchema(schemaText);
    if (res.error) {
      throw new Error(`Error parsing cbuf schema: ${res.error}\n\n${schemaText}`);
    }
    this.#schemaMap = res.schema;
    this.#hashMap = Cbuf.schemaMapToHashMap(this.#schemaMap);
    const msgdef = this.#schemaMap.get(messageType);
    if (!msgdef) {
      throw new Error(`Message type ${messageType} not found in schema`);
    }
    this.#msgdef = msgdef;
  }

  public writeMessage(message: unknown): Uint8Array {
    const msgEvent: CbufMessage = {
      typeName: this.#msgdef.name ?? "",
      size: 0,
      variant: 0,
      hashValue: this.#msgdef.hashValue,
      timestamp: nowSeconds(),
      message: message as Record<string, CbufValue>,
    };
    msgEvent.size = Cbuf.serializedMessageSize(this.#schemaMap, this.#hashMap, msgEvent);

    const buffer = Cbuf.serializeMessage(this.#schemaMap, this.#hashMap, msgEvent);
    return new Uint8Array(buffer);
  }
}
