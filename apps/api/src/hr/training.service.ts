import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'; import { prisma, tenantWhere } from '@scc/database';
@Injectable()
export class TrainingService{
 async listCourses(req:any){const data=await prisma.trainingCourse.findMany({where:{...tenantWhere(req.user?.tenantId)},include:{_count:{select:{enrollments:true}}},orderBy:{createdAt:'desc'}});return{data,count:data.length}}
 async createCourse(req:any,dto:any){const tenantId=req.user?.tenantId;if(await prisma.trainingCourse.findFirst({where:{...tenantWhere(tenantId),code:dto.code}}))throw new ConflictException('Training course code already exists');return prisma.trainingCourse.create({data:{tenantId,...dto,startDate:dto.startDate?new Date(dto.startDate):null,endDate:dto.endDate?new Date(dto.endDate):null}})}
 async listEnrollments(req:any,q:any){const where:any={...tenantWhere(req.user?.tenantId)};if(q.courseId)where.courseId=q.courseId;if(q.employeeId)where.employeeId=q.employeeId;const data=await prisma.trainingEnrollment.findMany({where,include:{employee:{select:{firstName:true,lastName:true,employeeCode:true}},course:{select:{code:true,title:true}}},orderBy:{createdAt:'desc'}});return{data,count:data.length}}
 async enroll(req:any,dto:any){
  const tenantId=req.user?.tenantId;
  if(!tenantId)throw new BadRequestException('Tenant is required');

  return prisma.$transaction(async tx=>{
   // Serializes all enrollments competing for seats in the same course.
   // PostgreSQL holds the row lock until commit/rollback.
   const locked=await tx.$queryRaw<Array<{id:string}>>`
    SELECT "id" FROM "training_courses"
    WHERE "id" = ${dto.courseId} AND "tenantId" = ${tenantId}
    FOR UPDATE
   `;
   if(locked.length!==1)throw new NotFoundException('Training course not found');

   const [course,employee]=await Promise.all([
    tx.trainingCourse.findFirst({where:{...tenantWhere(tenantId),id:dto.courseId}}),
    tx.employee.findFirst({where:{...tenantWhere(tenantId),id:dto.employeeId}}),
   ]);
   if(!course)throw new NotFoundException('Training course not found');
   if(!employee)throw new NotFoundException('Employee not found');
   if(course.status!=='OPEN')throw new BadRequestException('Training course must be OPEN for enrollment');
   if(employee.status!=='ACTIVE')throw new BadRequestException('Only active employees can be enrolled in training');

   const existing=await tx.trainingEnrollment.findFirst({
    where:{...tenantWhere(tenantId),courseId:dto.courseId,employeeId:dto.employeeId},
   });
   if(existing)throw new ConflictException('Employee already enrolled');

   if(course.capacity!==null){
    const count=await tx.trainingEnrollment.count({
     where:{tenantId,courseId:course.id,status:{not:'CANCELLED'}},
    });
    if(count>=course.capacity)throw new BadRequestException('Training course capacity reached');
   }

   return tx.trainingEnrollment.create({
    data:{tenantId,courseId:dto.courseId,employeeId:dto.employeeId,notes:dto.notes||null},
   });
  });
 }

 async complete(req:any,id:string,dto:any){const e=await prisma.trainingEnrollment.findFirst({where:{...tenantWhere(req.user?.tenantId),id}});if(!e)throw new NotFoundException('Training enrollment not found');if(e.status==='COMPLETED')throw new ConflictException('Training enrollment already completed');if(dto.score!==undefined&&(Number(dto.score)<0||Number(dto.score)>100))throw new BadRequestException('Training score must be between 0 and 100');return prisma.trainingEnrollment.update({where:{id},data:{status:'COMPLETED',score:dto.score??null,certificateNumber:dto.certificateNumber||null,notes:dto.notes??e.notes,completedAt:new Date()}})}
 async status(req:any,id:string,status:string){const c=await prisma.trainingCourse.findFirst({where:{...tenantWhere(req.user?.tenantId),id}});if(!c)throw new NotFoundException('Training course not found');return prisma.trainingCourse.update({where:{id},data:{status}})}
}
