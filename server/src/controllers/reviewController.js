import Joi from 'joi';
import mongoose from 'mongoose';
import { Review } from '../models/Review.js';

const objectId = Joi.string().hex().length(24);
const createSchema = Joi.object({
  courseCode: Joi.string().trim().required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('').optional(),
  reviewedBy: objectId.allow(null).optional()
}).options({ abortEarly: false, stripUnknown: true });
const updateSchema = Joi.object({
  courseCode: Joi.string().trim(), rating: Joi.number().integer().min(1).max(5),
  comment: Joi.string().allow(''), reviewedBy: objectId.allow(null)
}).min(1).options({ abortEarly: false, stripUnknown: true });
const validId = (id) => mongoose.isValidObjectId(id);
function databaseError(err, res, next) {
  if (err?.code === 11000) return res.status(409).json({ message: 'This user already reviewed this course' });
  return next(err);
}

export async function getAllReviews(req, res, next) {
  try {
    const reviews = await Review.find().populate('reviewedBy', 'name email').sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (err) { next(err); }
}

export async function getReview(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid review id' });
    const review = await Review.findById(req.params.id).populate('reviewedBy', 'name email');
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json({ review });
  } catch (err) { next(err); }
}

export async function getCourseSummary(req, res, next) {
  try {
    const { error, value } = Joi.object({ courseCode: Joi.string().trim().required() }).validate(req.query);
    if (error) return res.status(400).json({ message: error.message });
    const [summary] = await Review.aggregate([
      { $match: { courseCode: value.courseCode } },
      { $group: { _id: '$courseCode', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
      { $project: { _id: 0, courseCode: '$_id', averageRating: 1, reviewCount: 1 } }
    ]);
    res.json(summary || { courseCode: value.courseCode, averageRating: null, reviewCount: 0 });
  } catch (err) { next(err); }
}

export async function createReview(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const review = await Review.create(value);
    await review.populate('reviewedBy', 'name email');
    res.status(201).json({ review });
  } catch (err) { databaseError(err, res, next); }
}

export async function updateReview(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid review id' });
    const { value, error } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const review = await Review.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true }).populate('reviewedBy', 'name email');
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json({ review });
  } catch (err) { databaseError(err, res, next); }
}

export async function deleteReview(req, res, next) {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid review id' });
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
