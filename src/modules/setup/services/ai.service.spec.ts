import { Test, TestingModule } from '@nestjs/testing';
import { CsDocumentService } from './ai.service';

describe('CsDocumentService', () => {
  let service: CsDocumentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CsDocumentService],
    }).compile();

    service = module.get<CsDocumentService>(CsDocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('readCSDocument', () => {
    it('should run without throwing', () => {
      expect(() => service.readCSDocument()).not.toThrow();
    });
  });
});
