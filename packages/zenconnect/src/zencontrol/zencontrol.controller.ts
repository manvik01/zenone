import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GrantsService } from './grants.service';
import { AuditService } from './audit.service';
import {
  CreateGrantDto,
  GrantResponseDto,
  CheckGrantDto,
  CheckGrantResult,
  AuditQueryDto,
  AuditEntry,
  AuditResult,
} from '../common/dto/zencontrol.dto';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';

@Controller('v1/zencontrol')
@UseGuards(JwtAuthGuard)
export class ZenControlController {
  constructor(
    private readonly grantsService: GrantsService,
    private readonly auditService: AuditService,
  ) {}

  @Post('grants')
  async createGrant(
    @Request() req,
    @Body() createDto: CreateGrantDto,
  ): Promise<GrantResponseDto> {
    const userId = req.user.userId;
    const grant = this.grantsService.createGrant(userId, createDto);

    return {
      grantId: grant.grantId,
      deviceId: grant.deviceId,
      resourceType: grant.resourceType,
      resourcePath: grant.resourcePath,
      capabilities: grant.capabilities,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      createdAt: grant.createdAt,
    };
  }

  @Get('grants')
  async listGrants(@Request() req): Promise<GrantResponseDto[]> {
    const userId = req.user.userId;
    const grants = this.grantsService.findByUserId(userId);

    return grants.map((grant) => ({
      grantId: grant.grantId,
      deviceId: grant.deviceId,
      resourceType: grant.resourceType,
      resourcePath: grant.resourcePath,
      capabilities: grant.capabilities,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      createdAt: grant.createdAt,
    }));
  }

  @Delete('grants/:grantId')
  async revokeGrant(@Param('grantId') grantId: string): Promise<GrantResponseDto> {
    const grant = this.grantsService.revokeGrant(grantId);

    return {
      grantId: grant.grantId,
      deviceId: grant.deviceId,
      resourceType: grant.resourceType,
      resourcePath: grant.resourcePath,
      capabilities: grant.capabilities,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
      createdAt: grant.createdAt,
    };
  }

  @Post('check')
  async checkGrant(
    @Request() req,
    @Body() checkDto: CheckGrantDto,
  ): Promise<CheckGrantResult> {
    const userId = req.user.userId;

    const result = this.grantsService.checkGrant(
      userId,
      checkDto.deviceId,
      checkDto.resourceType,
      checkDto.resourcePath,
      checkDto.capability,
    );

    // Record audit entry
    this.auditService.recordCheck({
      userId,
      deviceId: checkDto.deviceId,
      action: 'check_grant',
      resourceType: checkDto.resourceType,
      resourcePath: checkDto.resourcePath,
      capability: checkDto.capability,
      result: result.granted ? AuditResult.GRANTED : AuditResult.DENIED,
      reason: result.reason,
    });

    return result;
  }

  @Get('audit')
  async queryAudit(@Query() queryDto: AuditQueryDto): Promise<AuditEntry[]> {
    return this.auditService.query(queryDto);
  }

  @Get('audit/stats')
  async getAuditStats(): Promise<{ total: number; granted: number; denied: number }> {
    return this.auditService.getStats();
  }
}
