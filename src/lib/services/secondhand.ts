import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData } from "./eventStore";
import { encryptStr } from "@/lib/encryption";

export interface SecondHandSaleInput {
  sellerName: string;
  fatherName?: string;
  nidNumber: string;
  model: string;
  purchasePrice: number;
  storeId: string;
}

export interface NidDocumentUpload {
  recordId: string;
  photoBase64: string;
}

export class SecureDocumentService {
  async uploadNidDocument(
    recordId: string,
    photoBase64: string,
    userId: string,
    storeId: string
  ): Promise<void> {
    const encrypted = encryptStr(photoBase64);

    await prisma.secondHandRecord.update({
      where: { id: recordId, storeId },
      data: {
        nidPhotoData: Buffer.from(encrypted.ciphertext, "base64"),
        encryptionIv: encrypted.iv,
      },
    });

    await eventStore.append({
      aggregateType: "SecondHandRecord",
      aggregateId: recordId,
      type: "UPDATED",
      payload: { action: "NID_UPLOADED" },
      userId,
      storeId,
    } as EventStoreData);
  }

  async downloadNidDocument(recordId: string, storeId?: string): Promise<Uint8Array | null> {
    const record = await prisma.secondHandRecord.findUnique({
      where: storeId ? { id: recordId, storeId } : { id: recordId },
      select: { nidPhotoData: true },
    });

    return record?.nidPhotoData ?? null;
  }
}

export class SecondHandService {
  async create(input: SecondHandSaleInput, userId: string) {
    const { storeId } = input;

    return prisma.$transaction(async (tx) => {
      const record = await tx.secondHandRecord.create({
        data: {
          sellerName: input.sellerName,
          fatherName: input.fatherName,
          nidNumber: input.nidNumber,
          model: input.model,
          purchasePrice: input.purchasePrice,
          storeId,
          isImmutable: true,
        },
      });

      await eventStore.append({
        aggregateType: "SecondHandRecord",
        aggregateId: record.id,
        type: "CREATED",
        payload: {
          sellerName: input.sellerName,
          nidNumber: input.nidNumber,
          model: input.model,
          purchasePrice: input.purchasePrice,
        },
        userId,
        storeId,
      } as EventStoreData, tx);

      return record;
    });
  }

  async findAll(storeId?: string) {
    return prisma.secondHandRecord.findMany({
      where: { storeId },
      orderBy: { date: "desc" },
    });
  }

  async findById(id: string, storeId?: string) {
    return prisma.secondHandRecord.findUnique({
      where: storeId ? { id, storeId } : { id },
    });
  }

  async getTotalPurchased(storeId?: string) {
    const result = await prisma.secondHandRecord.aggregate({
      where: { storeId },
      _sum: { purchasePrice: true },
    });

    return Number(result._sum.purchasePrice || 0);
  }
}

export const secureDocumentService = new SecureDocumentService();
export const secondHandService = new SecondHandService();