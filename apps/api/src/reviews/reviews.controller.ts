import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { GetReviewsQueryDto } from './dto/get-reviews-query.dto';
import { CreateRepoFileReviewDto } from './dto/create-repo-file-review.dto';
import { CreatePullRequestReviewDto } from './dto/create-pull-request-review.dto';
import { RateLimiterGuard } from '../common/guards/rate-limiter.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('reviews')
@UseGuards(AuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * POST /reviews
   * Initiates an end-to-end AI code review for the authenticated user.
   * Enforces DTO validation, IP-based sliding window rate limiting,
   * untrusted input isolation, strict server-side ownership assignment,
   * and database persistence.
   */
  @Post()
  @UseGuards(RateLimiterGuard, AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createReview(
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Strictly assign review ownership to the verified authenticated user;
    // client-supplied userId is completely ignored.
    return this.reviewsService.createReview(dto, user.id);
  }

  /**
   * POST /reviews/repository-file
   * Initiates an AI review of a specific file from a connected GitHub repository.
   * Verifies server-side repository ownership, path traversal checks, and bounds.
   */
  @Post('repository-file')
  @UseGuards(RateLimiterGuard, AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRepositoryFileReview(
    @Body() dto: CreateRepoFileReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.createRepositoryFileReview(dto, user.id);
  }

  /**
   * POST /reviews/pull-request
   * Initiates an AI review of eligible changed code files in an open Pull Request.
   * Verifies server-side repository ownership, filters binary/lock files, and bounds diff size.
   */
  @Post('pull-request')
  @UseGuards(RateLimiterGuard, AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPullRequestReview(
    @Body() dto: CreatePullRequestReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.createPullRequestReview(dto, user.id);
  }

  /**
   * GET /reviews
   * Retrieves paginated review history ordered by creation date descending,
   * restricted exclusively to the authenticated user's reviews.
   */
  @Get()
  @UseGuards(AuthGuard)
  async getReviews(
    @Query() query: GetReviewsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.findAll(query, user.id);
  }

  /**
   * GET /reviews/:id
   * Retrieves a specific code review and all its findings by UUID.
   * Scoped strictly to the authenticated user's ownership.
   * Returns HTTP 404 if not found or owned by another user without leaking existence.
   */
  @Get(':id')
  @UseGuards(AuthGuard)
  async getReviewById(
    @Param(
      'id',
      new ParseUUIDPipe({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        version: '4',
      }),
    )
    id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.findById(id, user.id);
  }
}
