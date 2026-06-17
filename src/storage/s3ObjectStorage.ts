import {
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import type { ObjectStorage, ObjectUploadInput, StoredObject } from "../types.js";

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

export class S3ObjectStorage implements ObjectStorage {
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
}

function stripEtag(etag: string | undefined): string | undefined {
  return etag?.replace(/^"|"$/g, "");
}
