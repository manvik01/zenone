import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Transfer, TransferStatus, CreateTransferDto } from '../common/dto/transfer.dto';

@Injectable()
export class TransfersService {
  private transfers: Map<string, Transfer> = new Map();

  create(createTransferDto: CreateTransferDto): Transfer {
    const transferId = uuidv4();

    const transfer: Transfer = {
      transferId,
      taskId: createTransferDto.taskId,
      sourceDeviceId: createTransferDto.sourceDeviceId,
      destinationDeviceId: createTransferDto.destinationDeviceId,
      fileDigest: createTransferDto.fileDigest,
      byteCount: createTransferDto.byteCount,
      status: TransferStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.transfers.set(transferId, transfer);
    return transfer;
  }

  findById(transferId: string): Transfer | null {
    return this.transfers.get(transferId) || null;
  }

  findByTaskId(taskId: string): Transfer | null {
    return Array.from(this.transfers.values()).find(
      (transfer) => transfer.taskId === taskId,
    ) || null;
  }

  updateStatus(transferId: string, status: TransferStatus): Transfer {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    transfer.status = status;
    transfer.updatedAt = new Date();
    this.transfers.set(transferId, transfer);

    return transfer;
  }

  verify(transferId: string, fileDigest: string): boolean {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    return transfer.fileDigest === fileDigest;
  }
}
