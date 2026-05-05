import { prisma } from "@/lib/prisma";
import { eventStore, EventStoreData } from "./eventStore";

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
    await prisma.secondHandRecord.update({
      where: { id: recordId },
      data: {
        nidPhotoData: Buffer.from(photoBase64, "base64"),
        encryptionIv: "inline",
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

  async downloadNidDocument(recordId: string): Promise<Uint8Array | null> {
    const record = await prisma.secondHandRecord.findUnique({
      where: { id: recordId },
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
      } as EventStoreData);

      return record;
    });
  }

  async findAll(storeId?: string) {
    return prisma.secondHandRecord.findMany({
      where: { storeId },
      orderBy: { date: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.secondHandRecord.findUnique({
      where: { id },
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