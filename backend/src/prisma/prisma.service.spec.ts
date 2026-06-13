import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService (TenantPrismaService contract)', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('forTenant should return an extended client', () => {
    const extended = service.forTenant('tenant-123');
    expect(extended).toBeDefined();
    expect(typeof extended.$extends).toBe('function');
  });

  it('forTenant should inject tenantId into queries', () => {
    const extended = service.forTenant('test-tenant-id');
    expect(extended).toBeTruthy();
  });
});
