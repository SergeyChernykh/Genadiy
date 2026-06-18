import {
  GetObjectCommand,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import type {
  ObjectDownloader,
  ObjectDownloadInput,
  ObjectStorage,
  ObjectUploadInput,
  StoredObject
} from "../types.js";

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export function createS3Client(config: S3StorageConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  };

  return new S3Client(clientConfig);
}

export class S3ObjectStorage implements ObjectStorage, ObjectDownloader {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async uploadBuffer(input: ObjectUploadInput): Promise<StoredObject> {
    const commandInput: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: input.key,
      Body: input.body
    };

    if (input.contentType) {
      commandInput.ContentType = input.contentType;
    }

    if (typeof input.contentLength === "number") {
      commandInput.ContentLength = input.contentLength;
    }

    const result = await this.client.send(new PutObjectCommand(commandInput));
    const stored: StoredObject = {
      bucket: this.bucket,
      key: input.key
    };

    const etag = stripEtag(result.ETag);
    if (etag) {
      stored.etag = etag;
    }

    return stored;
  }

  async downloadBuffer(input: ObjectDownloadInput): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.key
      })
    );

    if (!result.Body) {
      throw new Error(`Object ${input.bucket}/${input.key} has no response body.`);
    }

    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}

function stripEtag(etag: string | undefined): string | undefined {
  return etag?.replace(/^"|"$/g, "");
}
