import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto, TransferResponseDto, TransferStatus } from '../common/dto/transfer.dto';

@Controller('v1/transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  createTransfer(@Body() createTransferDto: CreateTransferDto): TransferResponseDto {
    const transfer = this.transfersService.create(createTransferDto);
    return this.toResponseDto(transfer);
  }

  @Get(':transferId')
  getTransfer(@Param('transferId') transferId: string): TransferResponseDto {
    const transfer = this.transfersService.findById(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }
    return this.toResponseDto(transfer);
  }

  @Post(':transferId/verify')
  verifyTransfer(
    @Param('transferId') transferId: string,
    @Body() body: { fileDigest: string },
  ) {
    const isValid = this.transfersService.verify(transferId, body.fileDigest);
    if (isValid) {
      this.transfersService.updateStatus(transferId, TransferStatus.SUCCEEDED);
    } else {
      this.transfersService.updateStatus(transferId, TransferStatus.FAILED);
    }
    return { valid: isValid };
  }

  private toResponseDto(transfer: any): TransferResponseDto {
    return {
      transferId: transfer.transferId,
      taskId: transfer.taskId,
      sourceDeviceId: transfer.sourceDeviceId,
      destinationDeviceId: transfer.destinationDeviceId,
      fileDigest: transfer.fileDigest,
      byteCount: transfer.byteCount,
      status: transfer.status,
      createdAt: transfer.createdAt,
    };
  }
}
