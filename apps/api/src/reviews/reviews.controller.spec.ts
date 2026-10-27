import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let mockReviewsService: {
    createReview: jest.Mock;
    findAll: jest.Mock;
    findById: jest.Mock;
  };

  const mockUser: AuthenticatedUser = {
    id: 'user-uuid-1',
    githubId: '12345678',
    username: 'octocat',
    name: 'The Octocat',
    email: 'octocat@github.com',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12345678',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockReviewsService = {
      createReview: jest.fn().mockResolvedValue({
        id: 'review-1',
        summary: 'Clean code',
        overallRisk: 'none',
        findings: [],
      }),
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 'review-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: mockReviewsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimiterGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createReview on POST /reviews with authenticated user ownership', async () => {
    const dto = {
      sourceCode: 'const x = 10;',
      language: 'typescript',
    };

    const res = await controller.createReview(dto, mockUser);

    expect(mockReviewsService.createReview).toHaveBeenCalledWith(dto, mockUser.id);
    expect(res).toEqual({
      id: 'review-1',
      summary: 'Clean code',
      overallRisk: 'none',
      findings: [],
    });
  });

  it('should ignore client-spoofed userId and use authenticated user id', async () => {
    const dtoWithSpoofedUser = {
      sourceCode: 'const x = 10;',
      language: 'typescript',
      userId: 'attacker-spoofed-id',
    };

    await controller.createReview(dtoWithSpoofedUser, mockUser);

    // Verified: passed user.id ('user-uuid-1'), NOT 'attacker-spoofed-id'
    expect(mockReviewsService.createReview).toHaveBeenCalledWith(
      dtoWithSpoofedUser,
      'user-uuid-1',
    );
  });

  it('should call findAll on GET /reviews scoped to authenticated user', async () => {
    const query = { page: 1, limit: 10 };
    await controller.getReviews(query, mockUser);
    expect(mockReviewsService.findAll).toHaveBeenCalledWith(query, mockUser.id);
  });

  it('should call findById on GET /reviews/:id scoped to authenticated user', async () => {
    await controller.getReviewById('review-123', mockUser);
    expect(mockReviewsService.findById).toHaveBeenCalledWith('review-123', mockUser.id);
  });
});
